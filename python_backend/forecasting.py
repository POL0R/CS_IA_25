import math
from typing import List, Dict

def recursive_moving_average(data: List[float], alpha: float = 0.6) -> float:
    """
    Computes the exponentially weighted moving average (recursive) for a list of values.
    More recent values have higher weight.
    """
    if not data:
        return 0.0
    avg = data[0]
    for x in data[1:]:
        avg = alpha * x + (1 - alpha) * avg
    return avg

def forecast_depletion_days(current_stock: float, daily_outflow: List[float], alpha: float = 0.6) -> float:
    """
    Forecasts the number of days until stock runs out using recursive moving average.
    """
    smoothed_avg = recursive_moving_average(daily_outflow, alpha)
    if smoothed_avg <= 0:
        return math.inf
    return current_stock / smoothed_avg

def detect_anomalies(daily_outflow: List[float], window: int = 5, threshold: float = 2.5) -> List[int]:
    """
    Detects spikes in daily outflow. A spike is when a day's usage is more than threshold x average of previous window days.
    Returns a list of indexes where spikes occurred.
    """
    anomalies = []
    for i in range(window, len(daily_outflow)):
        prev_avg = sum(daily_outflow[i-window:i]) / window
        if prev_avg > 0 and daily_outflow[i] > threshold * prev_avg:
            anomalies.append(i)
    return anomalies

def stock_forecast_analysis(current_stock: float, daily_outflow: List[float], alpha: float = 0.6) -> Dict:
    """
    Returns a dictionary with predicted depletion days, smoothed average, and anomaly indexes.
    """
    smoothed_avg = recursive_moving_average(daily_outflow, alpha)
    predicted_days = forecast_depletion_days(current_stock, daily_outflow, alpha)
    anomaly_indexes = detect_anomalies(daily_outflow)
    # Round up to next integer, minimum 1 if less than 1 and not inf
    if predicted_days == math.inf:
        rounded_days = None
    else:
        rounded_days = max(1, math.ceil(predicted_days))
    return {
        "predicted_depletion_days": rounded_days,
        "smoothed_daily_average": round(smoothed_avg, 1),
        "anomaly_indexes": anomaly_indexes
    }

# Example usage (for testing):
if __name__ == "__main__":
    daily_outflow = [4, 5, 6, 8, 15, 7, 6]
    current_stock = 40
    result = stock_forecast_analysis(current_stock, daily_outflow)
    print(result) 