#!/usr/bin/env python3
"""
Distance-only road freight cost estimator.

Models implemented:
  1. Linear:            C = F + v * d
  2. Exp-decay per-km:  C = d * (c_min + (c0 - c_min)*exp(-k*d))
  3. Piecewise linear:  Two breakpoints (b1, b2) with three slopes.

Selection criterion: Lowest Mean Absolute Error (MAE).

Author: (You)
"""

from __future__ import annotations
import math
import json
from dataclasses import dataclass
from typing import List, Tuple, Dict, Optional
import numpy as np

# --------------------------------------------------------------------------------------
# 1. YOUR DATA  (Replace this with your real historical (distance_km, actual_cost_inr))
# --------------------------------------------------------------------------------------
data: List[Tuple[float, float]] = [
    (100,  8000),
    (300, 15000),
    (450, 22000),   # Pune -> Goa (approx)
    (600, 25000),
    (800, 27000),
    (1000, 31000),
    (1250, 41000),  # Pune -> Raipur (given)
    (1500, 36000),
    (1900, 38000),  # Pune -> Punjab (approx)
    (2200, 42000),
]
# --------------------------------------------------------------------------------------

# ---------------- Utility Metrics ----------------
def mae(y_true, y_pred) -> float:
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    return float(np.mean(np.abs(y_true - y_pred)))

def mape(y_true, y_pred) -> float:
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    return float(np.mean(np.abs((y_true - y_pred) / y_true))) * 100.0

def median_abs_error(y_true, y_pred) -> float:
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    return float(np.median(np.abs(y_true - y_pred)))


# ---------------- Data Structures ----------------
@dataclass
class FitResult:
    name: str
    params: Dict[str, float]
    mae: float
    mape: float
    median_abs_err: float
    n_params: int


class DistanceCostModel:
    """
    Container for multiple distance-only truck freight cost models.
    """
    def __init__(self, distances: List[float], costs: List[float]):
        self.d = np.array(distances, dtype=float)
        self.c = np.array(costs, dtype=float)
        self.results: List[FitResult] = []
        self.best: Optional[FitResult] = None

    # ---------- Model 1: Linear ----------
    def fit_linear(self):
        """
        C = F + v * d
        Least squares closed-form.
        """
        A = np.vstack([np.ones_like(self.d), self.d]).T
        params, *_ = np.linalg.lstsq(A, self.c, rcond=None)
        F, v = params
        preds = F + v * self.d
        res = FitResult(
            name="linear",
            params={"F": float(F), "v": float(v)},
            mae=mae(self.c, preds),
            mape=mape(self.c, preds),
            median_abs_err=median_abs_error(self.c, preds),
            n_params=2
        )
        self.results.append(res)

    # ---------- Model 2: Exponential Decay per-km ----------
    def fit_exp_decay(self,
                      c_min_grid = np.linspace(10, 18, 9),
                      c0_grid    = np.linspace(35, 65, 7),
                      k_grid     = np.linspace(0.0003, 0.0020, 9)):
        """
        C = d * (c_min + (c0 - c_min) * exp(-k*d))
        Grid search (simple & robust for small parameter space).
        """
        best_err = float("inf")
        best_params = None
        best_preds = None

        for c_min in c_min_grid:
            for c0 in c0_grid:
                if c0 <= c_min:
                    continue
                for k in k_grid:
                    preds = self.d * (c_min + (c0 - c_min) * np.exp(-k * self.d))
                    err = mae(self.c, preds)
                    if err < best_err:
                        best_err = err
                        best_params = {"c_min": float(c_min),
                                       "c0": float(c0),
                                       "k": float(k)}
                        best_preds = preds

        if best_params:
            res = FitResult(
                name="exp_decay",
                params=best_params,
                mae=mae(self.c, best_preds),
                mape=mape(self.c, best_preds),
                median_abs_err=median_abs_error(self.c, best_preds),
                n_params=3
            )
            self.results.append(res)

    # ---------- Model 3: Piecewise Linear (Two Breakpoints) ----------
    def fit_piecewise(self,
                      b1_candidates = (400, 500, 600),
                      b2_candidates = (1100, 1300, 1500)):
        """
        Breakpoints b1 < b2, slopes m1, m2, m3 + intercept F.
        Cost is:
          C = F + m1*seg1 + m2*seg2 + m3*seg3
        where:
          seg1 = min(d, b1)
          seg2 = clip(d - b1, 0, b2 - b1)
          seg3 = max(d - b2, 0)
        """
        best_err = float("inf")
        best = None
        best_preds = None

        for b1 in b1_candidates:
            for b2 in b2_candidates:
                if b2 <= b1:
                    continue
                seg1 = np.minimum(self.d, b1)
                seg2 = np.clip(self.d - b1, 0, b2 - b1)
                seg3 = np.clip(self.d - b2, 0, None)
                A = np.vstack([np.ones_like(self.d), seg1, seg2, seg3]).T
                params, *_ = np.linalg.lstsq(A, self.c, rcond=None)
                F, m1, m2, m3 = params
                preds = F + m1*seg1 + m2*seg2 + m3*seg3
                err = mae(self.c, preds)
                if err < best_err:
                    best_err = err
                    best = {"F": float(F), "m1": float(m1), "m2": float(m2), "m3": float(m3),
                            "b1": float(b1), "b2": float(b2)}
                    best_preds = preds

        if best:
            res = FitResult(
                name="piecewise",
                params=best,
                mae=mae(self.c, best_preds),
                mape=mape(self.c, best_preds),
                median_abs_err=median_abs_error(self.c, best_preds),
                n_params=5
            )
            self.results.append(res)

    # ---------- Model Selection ----------
    def select_best(self, criterion: str = "mae", penalty_per_param: float = 0.0) -> FitResult:
        """
        Select best model.
        Optional simple complexity penalty: adjusted_score = metric + penalty_per_param * n_params
        """
        if not self.results:
            raise ValueError("No models fitted.")
        def score(r: FitResult):
            metric = getattr(r, criterion)
            return metric + penalty_per_param * r.n_params
        self.best = min(self.results, key=score)
        return self.best

    # ---------- Predict ----------
    def predict(self, d: float, model: Optional[str] = None) -> float:
        if model is None:
            if self.best is None:
                raise ValueError("Call select_best() first or specify model name.")
            model = self.best.name
        params = next(r.params for r in self.results if r.name == model)
        d = float(d)

        if model == "linear":
            return params["F"] + params["v"] * d

        elif model == "exp_decay":
            return d * (params["c_min"] +
                        (params["c0"] - params["c_min"]) * math.exp(-params["k"] * d))

        elif model == "piecewise":
            b1 = params["b1"]; b2 = params["b2"]
            seg1 = min(d, b1)
            seg2 = 0.0 if d <= b1 else min(d - b1, b2 - b1)
            seg3 = 0.0 if d <= b2 else d - b2
            return (params["F"] +
                    params["m1"] * seg1 +
                    params["m2"] * seg2 +
                    params["m3"] * seg3)
        else:
            raise ValueError(f"Unknown model '{model}'")

    def error_band(self, multiplier: float = 1.5) -> float:
        """
        Simple ± absolute INR error band derived from median absolute error.
        """
        if self.best is None:
            raise ValueError("Select best model first.")
        return multiplier * self.best.median_abs_err

    # ---------- Persistence ----------
    def export_best(self, path: str):
        if self.best is None:
            raise ValueError("No best model selected.")
        payload = {
            "model_name": self.best.name,
            "params": self.best.params
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    @staticmethod
    def load_and_predict(distance_km: float, path: str) -> float:
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        name = cfg["model_name"]
        params = cfg["params"]
        d = float(distance_km)
        # Re-implement prediction logic here (without needing full class):
        if name == "linear":
            return params["F"] + params["v"] * d
        elif name == "exp_decay":
            return d * (params["c_min"] +
                        (params["c0"] - params["c_min"]) * math.exp(-params["k"] * d))
        elif name == "piecewise":
            b1 = params["b1"]; b2 = params["b2"]
            seg1 = min(d, b1)
            seg2 = 0.0 if d <= b1 else min(d - b1, b2 - b1)
            seg3 = 0.0 if d <= b2 else d - b2
            return (params["F"] +
                    params["m1"] * seg1 +
                    params["m2"] * seg2 +
                    params["m3"] * seg3)
        else:
            raise ValueError(f"Unknown model name in file: {name}")


# -------------------- MAIN TRAIN / DEMO --------------------
if __name__ == "__main__":
    distances, costs = zip(*data)
    model = DistanceCostModel(distances, costs)

    model.fit_linear()
    model.fit_exp_decay()
    model.fit_piecewise()

    best = model.select_best(criterion="mae")  # or add penalty_per_param if desired

    print("=== Model Comparison ===")
    for r in model.results:
        print(f"{r.name:10s}  MAE={r.mae:8.1f}  MAPE={r.mape:6.2f}%  "
              f"MedianAbsErr={r.median_abs_err:8.1f}  Params={r.params}")

    print("\nBest model selected:", best.name)
    print("Best params:", best.params)

    examples = {
        "Pune-Goa (~450 km)": 450,
        "Pune-Punjab (~1900 km)": 1900,
        "Pune-Raipur (~1250 km)": 1250,
        "Example 1000 km": 1000
    }

    print("\n=== Predictions (Best Model) ===")
    for label, d in examples.items():
        print(f"{label:25s} -> {model.predict(d):8.0f} INR")

    band = model.error_band(multiplier=1.5)
    print(f"\nApproximate ± error band (1.5 * median abs error): ±{band:0.0f} INR")

    # Export best model
    model.export_best("chosen_truck_cost_model.json")
    print("\nSaved best model to chosen_truck_cost_model.json")

    # Quick reload test
    reload_test = DistanceCostModel.load_and_predict(1000, "chosen_truck_cost_model.json")
    print("Reloaded model predicts 1000 km cost:", round(reload_test, 2))

    # ------------- Simple wrapper you can import elsewhere -------------
    def predict_transport_cost(distance_km: float) -> float:
        """
        Public wrapper using currently selected best model (requires this module
        to stay in memory after training). For a separate process, load JSON.
        """
        return model.predict(distance_km)

    # Example usage
    print("Wrapper function 1500 km:", predict_transport_cost(1500)) 