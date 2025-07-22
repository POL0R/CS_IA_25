from typing import List, Dict
from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import sessionmaker
from db_init import get_engine
from models import Product
import json
import numpy as np
from collections import Counter

PRIORITY_ORDER = {'critical': 3, 'high': 2, 'medium': 1, 'low': 0}

# Example: requisition = {"product_id": "P123", "requested_by": "Assembly Dept", "quantity": 10, "priority": "high", "timestamp": "2025-07-15T10:30:00"}
def aggregate_requisitions(requisitions: List[Dict], product_lookup: Dict[str, Dict] = None, supplier_lookup=None) -> List[Dict]:
    grouped = defaultdict(list)
    for req in requisitions:
        grouped[req['product_id']].append(req)
    result = []
    for product_id, reqs in grouped.items():
        total_requested = sum(r['quantity'] for r in reqs)
        priorities = [r['priority'] for r in reqs]
        highest_priority = max(priorities, key=lambda p: PRIORITY_ORDER.get(p, -1))
        reqs_sorted = sorted(reqs, key=lambda r: (-PRIORITY_ORDER.get(r['priority'], -1), r['timestamp']))
        departments = list({r['requested_by'] for r in reqs})
        latest_request = max(r['timestamp'] for r in reqs)
        product_name = product_lookup[product_id]['name'] if product_lookup and product_id in product_lookup else None
        result.append({
            'product_id': product_id,
            'product_name': product_name,
            'total_requested': total_requested,
            'departments': departments,
            'priority': highest_priority,
            'latest_request': latest_request
        })
    # Sort final output by priority and latest_request (descending)
    result.sort(key=lambda x: (-PRIORITY_ORDER.get(x['priority'], -1), x['latest_request']), reverse=False)
    return result 

def jaccard_similarity(a, b):
    set_a = set(a)
    set_b = set(b)
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)

def match_products_to_requirements(input_data):
    """
    Returns a list of matched products with scores and explanations.
    """
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    products = session.query(Product).all()
    results = []
    # Weights
    WEIGHTS = {
        'load': 0.4,
        'application': 0.2,
        'compliance': 0.2,
        'features': 0.2
    }
    for p in products:
        why = []
        # Load compatibility
        load_score = 0.0
        if p.min_load_kw is not None and p.max_load_kw is not None and input_data.get('power_load_kw'):
            if p.min_load_kw <= input_data['power_load_kw'] <= p.max_load_kw:
                load_score = 1.0
                why.append(f"Supports {input_data['power_load_kw']}kW load")
            elif p.min_load_kw <= input_data['power_load_kw'] + 10 <= p.max_load_kw:
                load_score = 0.7
                why.append(f"Close to required load range")
        # Application tag match
        app_tags = json.loads(p.application_tags) if p.application_tags else []
        input_app = [input_data.get('application', '').lower()]
        app_score = jaccard_similarity([a.lower() for a in app_tags], input_app)
        if app_score > 0:
            why.append(f"Application: {input_data['application']}")
        # Compliance match
        comp_tags = json.loads(p.compliance_tags) if p.compliance_tags else []
        input_comp = [c.lower() for c in input_data.get('compliance', [])]
        comp_score = jaccard_similarity([c.lower() for c in comp_tags], input_comp)
        if comp_score > 0:
            why.append(f"Compliant with {', '.join(input_data.get('compliance', []))}")
        # Feature overlap
        prod_features = json.loads(p.features) if p.features else []
        input_features = [f.lower() for f in input_data.get('preferred_features', [])]
        feat_score = jaccard_similarity([f.lower() for f in prod_features], input_features)
        if feat_score > 0:
            why.append(f"Includes features: {', '.join(input_data.get('preferred_features', []))}")
        # Weighted score
        match_score = (
            WEIGHTS['load'] * load_score +
            WEIGHTS['application'] * app_score +
            WEIGHTS['compliance'] * comp_score +
            WEIGHTS['features'] * feat_score
        )
        # Stock/lead time
        stock_status = 'In Stock' if (p.quantity or 0) > 0 else 'Out of Stock'
        lead_time_days = p.lead_time_days or 0
        results.append({
            'product_id': p.id,
            'name': p.name,
            'match_score': round(match_score, 2),
            'why_suitable': why,
            'stock_status': stock_status,
            'lead_time_days': lead_time_days
        })
    # Sort by match_score desc
    results.sort(key=lambda x: x['match_score'], reverse=True)
    session.close()
    return results

def generate_price_breakdown(product_id: int, quantity: int, include_installation: bool = False):
    """
    Returns a detailed price breakdown for a product and quantity.
    """
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    p = session.query(Product).filter_by(id=product_id).first()
    if not p:
        session.close()
        return {'error': 'Product not found'}
    # Base price
    base_price = (p.base_price or p.cost or 0) * quantity
    customization_fee = (p.customization_fee or 0) * quantity
    installation_charge = (p.installation_fee or 0) * quantity if include_installation else 0
    delivery_fee = (p.delivery_fee or 0) * quantity
    tax_amount = 0.18 * (base_price + customization_fee + installation_charge)  # 18% GST
    total_price = base_price + customization_fee + installation_charge + delivery_fee + tax_amount
    procurement_cost = (p.procurement_cost or p.cost or 0) * quantity
    estimated_overheads = 0  # Placeholder for future logic
    net_profit = total_price - (procurement_cost + estimated_overheads)
    profit_margin_percent = (net_profit / total_price * 100) if total_price else 0
    session.close()
    return {
        'product_base_price': base_price,
        'customization_fee': customization_fee,
        'installation_charge': installation_charge,
        'tax_amount': tax_amount,
        'delivery_fee': delivery_fee,
        'total_price': total_price,
        'profit_margin_percent': round(profit_margin_percent, 2),
        'net_profit_amount': net_profit,
        'note': p.warranty_note or "Includes 1-year warranty and on-site support"
    } 