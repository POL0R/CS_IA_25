import statistics
from datetime import datetime, timedelta
from typing import List, Dict

class Supplier:
    def __init__(self, name: str):
        self._name = name
        self._transactions = []  # List of dicts

    def add_transaction(self, transaction: Dict):
        self._transactions.append(transaction)

    def get_name(self):
        return self._name

    def get_transactions(self):
        return self._transactions

    def average_unit_price(self):
        prices = [t['unit_price'] for t in self._transactions]
        return round(statistics.mean(prices), 2) if prices else 0.0

    def on_time_rate(self):
        on_time = 0
        total = 0
        for t in self._transactions:
            if 'order_date' in t and 'delivery_date' in t and 'lead_time' in t:
                lead_time = (t['delivery_date'] - t['order_date']).days
                if lead_time <= t['lead_time']:
                    on_time += 1
                total += 1
        return round(100 * on_time / total, 1) if total else 0.0

    def rejection_rate(self):
        total_ordered = sum(t['quantity_ordered'] for t in self._transactions)
        total_rejected = sum(t.get('rejected_quantity', 0) for t in self._transactions)
        return round(100 * total_rejected / total_ordered, 2) if total_ordered else 0.0

    def average_lead_time(self):
        lead_times = [(t['delivery_date'] - t['order_date']).days for t in self._transactions if 'order_date' in t and 'delivery_date' in t]
        return round(statistics.mean(lead_times), 2) if lead_times else 0.0

    def reliability_score(self):
        # Weighted: on-time (40%), rejection (30%), lead time (20%), price (10%)
        on_time = self.on_time_rate()
        rejection = self.rejection_rate()
        lead_time = self.average_lead_time()
        price = self.average_unit_price()
        # Normalize: higher on-time, lower rejection, lower lead time, lower price
        score = (
            (on_time / 100) * 4 +
            (1 - rejection / 100) * 3 +
            (1 - min(lead_time / 10, 1)) * 2 +
            (1 - min(price / 100, 1)) * 1
        ) * 2  # Scale to 10
        return round(score, 2)

class LocalSupplier(Supplier):
    def reliability_score(self):
        # Local suppliers get a small bonus for lead time
        base = super().reliability_score()
        lead_time = self.average_lead_time()
        bonus = 0.5 if lead_time < 5 else 0
        return round(base + bonus, 2)

class InternationalSupplier(Supplier):
    def reliability_score(self):
        # International suppliers penalized for lead time > 7 days
        base = super().reliability_score()
        lead_time = self.average_lead_time()
        penalty = -0.5 if lead_time > 7 else 0
        return round(base + penalty, 2)

class SupplierPerformanceManager:
    def __init__(self, suppliers: List[Supplier]):
        self._suppliers = suppliers

    def evaluate(self):
        report = []
        for s in self._suppliers:
            report.append({
                'name': s.get_name(),
                'avg_price': s.average_unit_price(),
                'on_time_rate': s.on_time_rate(),
                'rejection_rate': s.rejection_rate(),
                'avg_lead_time': s.average_lead_time(),
                'score': s.reliability_score(),
            })
        # Sort by score desc, then price asc, then lead time asc
        report.sort(key=lambda x: (-x['score'], x['avg_price'], x['avg_lead_time']))
        return report

    def get_ui_data(self, product_name: str = "Product"):
        # Returns data formatted for React UI components
        report = self.evaluate()
        return {
            'product_name': product_name,
            'suppliers': report,
            'total_suppliers': len(report),
            'best_supplier': report[0] if report else None,
            'worst_supplier': report[-1] if report else None,
            'average_score': round(statistics.mean([s['score'] for s in report]), 2) if report else 0
        }

def generate_sample_data():
    # Returns sample supplier performance data for demonstration
    suppliers = [
        LocalSupplier('Elektra India Ltd.'),
        InternationalSupplier('Apex Distributors'),
        LocalSupplier('Metro Components'),
    ]
    # Simulated transactions (for product K110)
    base_date = datetime(2025, 7, 1)
    transactions = [
        # Elektra India Ltd.
        {'supplier': 0, 'unit_price': 48.0, 'order_date': base_date, 'delivery_date': base_date + timedelta(days=4), 'lead_time': 5, 'quantity_ordered': 100, 'quantity_received': 99, 'rejected_quantity': 1},
        {'supplier': 0, 'unit_price': 49.0, 'order_date': base_date + timedelta(days=10), 'delivery_date': base_date + timedelta(days=14), 'lead_time': 5, 'quantity_ordered': 120, 'quantity_received': 119, 'rejected_quantity': 1},
        {'supplier': 0, 'unit_price': 48.9, 'order_date': base_date + timedelta(days=20), 'delivery_date': base_date + timedelta(days=24), 'lead_time': 5, 'quantity_ordered': 110, 'quantity_received': 109, 'rejected_quantity': 1},
        {'supplier': 0, 'unit_price': 47.3, 'order_date': base_date + timedelta(days=30), 'delivery_date': base_date + timedelta(days=34), 'lead_time': 5, 'quantity_ordered': 130, 'quantity_received': 129, 'rejected_quantity': 1},
        # Apex Distributors
        {'supplier': 1, 'unit_price': 46.5, 'order_date': base_date, 'delivery_date': base_date + timedelta(days=8), 'lead_time': 6, 'quantity_ordered': 100, 'quantity_received': 94, 'rejected_quantity': 6},
        {'supplier': 1, 'unit_price': 46.7, 'order_date': base_date + timedelta(days=10), 'delivery_date': base_date + timedelta(days=18), 'lead_time': 6, 'quantity_ordered': 120, 'quantity_received': 113, 'rejected_quantity': 7},
        {'supplier': 1, 'unit_price': 46.3, 'order_date': base_date + timedelta(days=20), 'delivery_date': base_date + timedelta(days=28), 'lead_time': 6, 'quantity_ordered': 110, 'quantity_received': 104, 'rejected_quantity': 6},
        # Metro Components
        {'supplier': 2, 'unit_price': 50.0, 'order_date': base_date, 'delivery_date': base_date + timedelta(days=3), 'lead_time': 4, 'quantity_ordered': 90, 'quantity_received': 90, 'rejected_quantity': 0},
        {'supplier': 2, 'unit_price': 49.5, 'order_date': base_date + timedelta(days=10), 'delivery_date': base_date + timedelta(days=13), 'lead_time': 4, 'quantity_ordered': 100, 'quantity_received': 99, 'rejected_quantity': 1},
        {'supplier': 2, 'unit_price': 50.2, 'order_date': base_date + timedelta(days=20), 'delivery_date': base_date + timedelta(days=24), 'lead_time': 4, 'quantity_ordered': 110, 'quantity_received': 109, 'rejected_quantity': 1},
    ]
    for t in transactions:
        suppliers[t['supplier']].add_transaction(t)
    return suppliers

def get_supplier_performance_ui(product_name: str = "Contactor K110"):
    # Function to get UI-ready supplier performance data
    suppliers = generate_sample_data()
    manager = SupplierPerformanceManager(suppliers)
    return manager.get_ui_data(product_name)

def print_html_report(product_name: str = "Contactor K110"):
    # Print a formatted HTML report for immediate viewing
    data = get_supplier_performance_ui(product_name)
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Supplier Performance Report - {product_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin:40px; background: #f5f5f5; }}
        .container {{ max-width:1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; text-align: center; margin-bottom: 30px; }}
        .summary {{ background: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20; }}
        .summary-item {{ text-align: center; }}
        .summary-value {{ font-size: 24px; font-weight: bold; color: #3498db; }}
        .summary-label {{ color: #7f8c8d; font-size: 14px; }}
        .suppliers {{ display: grid; gap: 20; }}
        .supplier-card {{ border: 1px solid #ddd; border-radius: 8px; padding: 20px; position: relative; }}
        .supplier-card:nth-child(1) {{ border-color: #27ae60; background: linear-gradient(135deg, #d5e6f8 0%, #f8f9fa 10%); }}
        .supplier-card:nth-child(2) {{ border-color: #f39c12; background: linear-gradient(135deg, #fdeaa7 0%, #f8f9fa 10%); }}
        .supplier-card:nth-child(3) {{ border-color: #e74c3c; background: linear-gradient(135deg, #fadbd8 0%, #f8f9fa 10%); }}
        .rank {{ position: absolute; top: -10px; left: -10px; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; }}
        .rank-1 {{ background: #27ae60; }}
        .rank-2 {{ background: #f39c12; }}
        .rank-3 {{ background: #e74c3c; }}
        .supplier-name {{ font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #239b56; }}
        .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15; }}
        .metric {{ text-align: center; }}
        .metric-value {{ font-size: 20px; font-weight: bold; margin-bottom: 5px; }}
        .metric-label {{ font-size: 12px; color: #7f8c8d; text-transform: uppercase; }}
        .score {{ font-size: 24px; font-weight: bold; text-align: center; margin-top: 15px; padding: 10px; background: #34495e; color: white; border-radius: 5px; }}
        .good {{ color: #27ae60; }}
        .warning {{ color: #f39c12; }}
        .poor {{ color: #e74c3c; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🏭 Supplier Performance Report</h1>
        <h2 style="text-align: center; color: #7f8c8d; margin-bottom: 30px;">{product_name}</h2>
        
        <div class="summary">
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">{data['total_suppliers']}</div>
                    <div class="summary-label">Total Suppliers</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{data['average_score']}</div>
                    <div class="summary-label">Average Score</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{data['best_supplier']['name'] if data['best_supplier'] else 'N/A'}</div>
                    <div class="summary-label">Best Performer</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">₹{data['best_supplier']['avg_price'] if data['best_supplier'] else 0}</div>
                    <div class="summary-label">Best Price</div>
                </div>
            </div>
        </div>
        
        <div class="suppliers">
"""
    
    for idx, supplier in enumerate(data['suppliers'], 1):
        score_class = 'good' if supplier['score'] >= 8 else 'warning' if supplier['score'] >= 6 else 'poor'
        html += f"""            <div class="supplier-card">
                <div class="rank rank-{idx}">{idx}</div>
                <div class="supplier-name">{supplier['name']}</div>
                <div class="metrics">
                    <div class="metric">
                        <div class="metric-value">₹{supplier['avg_price']}</div>
                        <div class="metric-label">Avg Price</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value {score_class}">{supplier['on_time_rate']}%</div>
                        <div class="metric-label">On-time Rate</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value {score_class}">{supplier['rejection_rate']}%</div>
                        <div class="metric-label">Rejection Rate</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">{supplier['avg_lead_time']} days</div>
                        <div class="metric-label">Avg Lead Time</div>
                    </div>
                </div>
                <div class="score {score_class}">Score: {supplier['score']}/10</div>
            </div> 
"""
    html += """        </div>
    </div>
</body>
</html>
"""    
    # Save to file
    with open('supplier_performance_report.html', 'w') as f:
        f.write(html)
    
    print(f"📊 HTML report generated: supplier_performance_report.html")
    print(f"🌐 Open this file in your browser to view the UI")
    return html

# --- Sample Usage ---
if __name__ == '__main__':
    # Generate HTML report
    print_html_report("Contactor K110")  
    # Also show console output
    print("="*50)
    print("CONSOLE OUTPUT:")
    print("="*50)
    
    suppliers = generate_sample_data()
    manager = SupplierPerformanceManager(suppliers)
    report = manager.evaluate()
    print("Supplier Evaluation Report – Contactor K110")
    for idx, s in enumerate(report, 1):
        print(f"{idx}. {s['name']}")
        print(f"   - Avg Price: ₹{s['avg_price']}")
        print(f"   - On-time Rate: {s['on_time_rate']}%")
        print(f"   - Rejection Rate: {s['rejection_rate']}%")
        print(f"   - Avg Lead Time: {s['avg_lead_time']} days")
        print(f"   - Score: {s['score']}")
        print()
    
    # Show UI data structure
    print("="*50)
    print("UI DATA STRUCTURE (for React):")
    print("="*50)
    import json
    ui_data = get_supplier_performance_ui("Contactor K110")
    print(json.dumps(ui_data, indent=2)) 