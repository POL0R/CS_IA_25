from typing import List, Dict
from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import sessionmaker
from db_init import get_engine
from models import FinishedProduct, Product, FinishedProductMaterial, FinishedProductSkill, Skill
import json
import numpy as np
from collections import Counter
import math
import requests
import os
import sys

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    # Try to load from client directory first, then current directory
    client_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'client', '.env')
    if os.path.exists(client_env_path):
        load_dotenv(client_env_path)
    else:
        load_dotenv()
except ImportError:
    # If python-dotenv is not available, manually load .env file
    client_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'client', '.env')
    if os.path.exists(client_env_path):
        with open(client_env_path, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value

PRIORITY_ORDER = {'critical': 3, 'high': 2, 'medium': 1, 'low': 0}

def calculate_transportation_cost(delivery_address: str) -> float:
    """
    Calculate transportation cost based on delivery address.
    Uses Mapbox for accurate geocoding and distance calculation.
    """
    if not delivery_address:
        return 0.0
    
    # Default warehouse location (Pune, India)
    warehouse_lat, warehouse_lng = 18.5204, 73.8567
    
    try:
        # Import the geocoding function from api.py
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        
        # Get Mapbox token from environment
        mapbox_token = os.environ.get('MAPBOX_TOKEN') or os.environ.get('VITE_MAPBOX_TOKEN') or 'YOUR_MAPBOX_TOKEN'
        
        if mapbox_token == 'YOUR_MAPBOX_TOKEN' or not mapbox_token:
            # Use the same distance calculation logic as our new endpoint
            from math import radians, cos, sin, asin, sqrt
            
            # Warehouse location (Pune, India)
            warehouse_lat, warehouse_lng = 18.5204, 73.8567
            
            # Predefined coordinates for major Indian cities
            city_coordinates = {
                'mumbai': (19.0760, 72.8777),
                'delhi': (28.7041, 77.1025),
                'bangalore': (12.9716, 77.5946),
                'hyderabad': (17.3850, 78.4867),
                'chennai': (13.0827, 80.2707),
                'kolkata': (22.5726, 88.3639),
                'pune': (18.5204, 73.8567),
                'ahmedabad': (23.0225, 72.5714),
                'surat': (21.1702, 72.8311),
                'jaipur': (26.9124, 75.7873),
                'lucknow': (26.8467, 80.9462),
                'kanpur': (26.4499, 80.3319),
                'nagpur': (21.1458, 79.0882),
                'indore': (22.7196, 75.8577),
                'thane': (19.2183, 72.9781),
                'bhopal': (23.2599, 77.4126),
                'visakhapatnam': (17.6868, 83.2185),
                'patna': (25.5941, 85.1376),
                'vadodara': (22.3072, 73.1812),
                'ghaziabad': (28.6692, 77.4538)
            }
            
            # Check if the address contains any known city names
            address_lower = delivery_address.lower()
            matched_coords = None
            
            for city, coords in city_coordinates.items():
                if city in address_lower:
                    matched_coords = coords
                    break
            
            if matched_coords:
                delivery_lat, delivery_lng = matched_coords
                
                # Calculate distance using Haversine formula
                R = 6371  # Earth's radius in kilometers
                lat1, lng1, lat2, lng2 = map(radians, [warehouse_lat, warehouse_lng, delivery_lat, delivery_lng])
                dlat = lat2 - lat1
                dlng = lng2 - lng1
                
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
                c = 2 * asin(sqrt(a))
                distance_km = R * c
                
                print(f"Distance calculation: {delivery_address} -> {distance_km:.2f} km")
            else:
                # Fallback: estimate distance based on address length
                distance_km = len(delivery_address) * 0.5 + 50
                print(f"Estimated distance for {delivery_address}: {distance_km:.2f} km")
        else:
            # Use Mapbox for accurate geocoding and distance calculation
            import requests
            
            # Geocode the delivery address
            geocode_url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{delivery_address}.json?access_token={mapbox_token}&country=IN"
            geocode_response = requests.get(geocode_url)
            geocode_data = geocode_response.json()
            
            if geocode_data.get('features') and len(geocode_data['features']) > 0:
                # Get coordinates from the first result
                delivery_lng, delivery_lat = geocode_data['features'][0]['center']
                
                # Calculate distance using Haversine formula
                from math import radians, cos, sin, asin, sqrt
                
                R = 6371  # Earth's radius in kilometers
                lat1, lng1, lat2, lng2 = map(radians, [warehouse_lat, warehouse_lng, delivery_lat, delivery_lng])
                dlat = lat2 - lat1
                dlng = lng2 - lng1
                
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
                c = 2 * asin(sqrt(a))
                distance_km = R * c
                
                print(f"Mapbox geocoding: {delivery_address} -> ({delivery_lat}, {delivery_lng})")
                print(f"Distance from Pune warehouse: {distance_km:.2f} km")
            else:
                # Fallback if geocoding fails
                distance_km = 500
                print(f"Mapbox geocoding failed for: {delivery_address}")
        
        # Use the truck cost model to predict transportation cost
        try:
            with open("chosen_truck_cost_model.json", "r", encoding="utf-8") as f:
                truck_cost_cfg = json.load(f)
        except Exception:
            # Fallback to simple calculation if model not available
            return distance_km * 15  # 15 INR per km as fallback
        
        # Calculate cost using the model
        name = truck_cost_cfg["model_name"]
        params = truck_cost_cfg["params"]
        d = float(distance_km)
        
        if name == "linear":
            cost = params["F"] + params["v"] * d
        elif name == "exp_decay":
            cost = d * (params["c_min"] + (params["c0"] - params["c_min"]) * math.exp(-params["k"] * d))
        elif name == "piecewise":
            b1 = params["b1"]
            b2 = params["b2"]
            seg1 = min(d, b1)
            seg2 = 0.0 if d <= b1 else min(d - b1, b2 - b1)
            seg3 = 0.0 if d <= b2 else d - b2
            cost = (params["F"] + params["m1"] * seg1 + params["m2"] * seg2 + params["m3"] * seg3)
        else:
            cost = distance_km * 15  # Fallback
        
        print(f"Transportation cost for {distance_km:.2f} km: ₹{cost:.2f}")
        return round(cost, 2)
            
    except Exception as e:
        print(f"Error calculating transportation cost: {e}")
        return 0.0

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
    Returns a list of matched finished products with scores and explanations.
    """
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    products = session.query(FinishedProduct).all()
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
            # Convert power_load_kw to float to handle both string and numeric inputs
            try:
                power_load = float(input_data['power_load_kw'])
                if p.min_load_kw <= power_load <= p.max_load_kw:
                    load_score = 1.0
                    why.append(f"Supports {power_load}kW load")
                elif p.min_load_kw <= power_load + 10 <= p.max_load_kw:
                    load_score = 0.7
                    why.append(f"Close to required load range")
            except (ValueError, TypeError):
                # If conversion fails, skip load scoring
                pass
        # Application tag match
        app_tags = json.loads(p.application_tags) if p.application_tags else []
        input_app = [input_data.get('application', '').lower()]
        app_score = jaccard_similarity([a.lower() for a in app_tags], input_app)
        if app_score > 0:
            why.append(f"Application: {input_data['application']}")
        # Compliance match
        comp_tags = json.loads(p.compliance_tags) if p.compliance_tags else []
        input_comp_raw = input_data.get('compliance', [])
        # Handle both single string and array inputs
        if isinstance(input_comp_raw, str):
            input_comp = [input_comp_raw.lower()]
        else:
            input_comp = [c.lower() for c in input_comp_raw]
        comp_score = jaccard_similarity([c.lower() for c in comp_tags], input_comp)
        if comp_score > 0:
            why.append(f"Compliant with {', '.join(input_comp)}")
        # Feature overlap
        prod_features = json.loads(p.features) if p.features else []
        input_features_raw = input_data.get('preferred_features', [])
        # Handle both single string and array inputs
        if isinstance(input_features_raw, str):
            input_features = [input_features_raw.lower()]
        else:
            input_features = [f.lower() for f in input_features_raw]
        feat_score = jaccard_similarity([f.lower() for f in prod_features], input_features)
        if feat_score > 0:
            why.append(f"Includes features: {', '.join(input_features)}")
        # Weighted score
        match_score = (
            WEIGHTS['load'] * load_score +
            WEIGHTS['application'] * app_score +
            WEIGHTS['compliance'] * comp_score +
            WEIGHTS['features'] * feat_score
        )
        # Stock/lead time (for finished products, use materials availability or set as 'Available')
        stock_status = 'Available'
        lead_time_days = 0
        # Parse tags and features for display
        app_tags = json.loads(p.application_tags) if p.application_tags else []
        comp_tags = json.loads(p.compliance_tags) if p.compliance_tags else []
        prod_features = json.loads(p.features) if p.features else []
        
        results.append({
            'product_id': p.id,
            'model_name': p.model_name,
            'total_cost': p.total_cost or 0,  # Keep for internal reference
            'base_price': p.base_price or p.total_cost or 0,  # Use base_price for customer display
            'profit_margin_percent': p.profit_margin_percent or 20.0,
            'match_score': round(match_score * 100, 1),  # Convert to percentage
            'application_tags': app_tags,
            'compliance_tags': comp_tags,
            'features': prod_features,
            'photo_url': p.photo_url,
            'why_suitable': why,
            'stock_status': stock_status,
            'lead_time_days': lead_time_days
        })
    # Sort by match_score desc
    results.sort(key=lambda x: x['match_score'], reverse=True)
    session.close()
    return results

def generate_price_breakdown(product_id: int, quantity: int, include_installation: bool = False, delivery_address: str = ""):
    """
    Returns a detailed price breakdown for a product and quantity.
    Handles both raw products and finished products.
    """
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    # Try to fetch as finished product first
    fp = session.query(FinishedProduct).filter_by(id=product_id).first()
    if fp:
        # Use base_price from finished product (includes profit margin)
        base_price = fp.base_price or fp.total_cost or 0
        product_base_price = base_price * quantity
        
        # --- MATERIAL COST (for breakdown display) ---
        material_rows = session.query(FinishedProductMaterial).filter_by(finished_product_id=fp.id).all()
        total_materials_cost = 0
        materials_breakdown = []
        for m in material_rows:
            prod = session.query(Product).filter_by(id=m.material_id).first()
            if prod:
                cost = (prod.cost or 0) * m.quantity
                total_materials_cost += cost
                materials_breakdown.append({
                    'name': prod.name,
                    'quantity': m.quantity,
                    'unit_cost': prod.cost or 0,
                    'total_cost': cost
                })
        # Update materials breakdown to reflect order quantity
        for material in materials_breakdown:
            material['quantity'] *= quantity
            material['total_cost'] *= quantity
        
        total_materials_cost *= quantity
        # --- LABOR COST ---
        skill_rels = session.query(FinishedProductSkill).filter_by(finished_product_id=fp.id).all()
        skill_names = []
        for rel in skill_rels:
            skill = session.query(Skill).filter_by(id=rel.skill_id).first()
            if skill:
                skill_names.append(skill.name)
        estimated_hours = fp.estimated_hours or 1
        # Use the same logic as /calculate-labor-cost endpoint
        from api import calculate_labor_cost as calc_labor_cost_fn
        # Simulate a request to the labor cost function
        labor_cost = 0
        try:
            # Directly call the function if possible
            from flask import jsonify
            result = calc_labor_cost_fn.__wrapped__({'skills': skill_names, 'estimated_hours': estimated_hours})
            if isinstance(result, dict):
                labor_cost = result.get('labor_cost', 0) * quantity
            elif hasattr(result, 'json'):
                labor_cost = result.json.get('labor_cost', 0) * quantity
        except Exception:
            labor_cost = 0
        # --- OTHER COSTS ---
        customization_fee = 0  # Add logic if needed
        
        # Calculate transportation cost based on delivery address
        delivery_fee = calculate_transportation_cost(delivery_address)
        
        # Calculate installation charge based on product base price
        subtotal_before_installation = product_base_price + customization_fee
        if include_installation:
            if subtotal_before_installation < 80000:
                installation_charge = subtotal_before_installation * 0.10  # 10% for orders under 80k
            elif subtotal_before_installation <= 170000:
                installation_charge = subtotal_before_installation * 0.05  # 5% for orders between 80k and 170k
            else:
                installation_charge = subtotal_before_installation * 0.04  # 4% for orders over 170k
        else:
            installation_charge = 0
            
        tax_amount = 0.18 * (subtotal_before_installation + installation_charge)
        total_price = subtotal_before_installation + installation_charge + delivery_fee + tax_amount
        # Calculate profit margin and net profit for finished products
        # Use base_price which already includes profit margin
        procurement_cost = 0
        for m in material_rows:
            prod = session.query(Product).filter_by(id=m.material_id).first()
            if prod:
                procurement_cost += (prod.procurement_cost or prod.cost or 0) * m.quantity
        procurement_cost *= quantity
        estimated_overheads = 0  # Placeholder for future logic
        
        # Calculate net profit based on base_price vs actual costs
        actual_cost = procurement_cost + labor_cost + estimated_overheads
        net_profit = product_base_price - actual_cost
        # The profit margin is already built into base_price, so we use the stored value
        session.close()
        return {
            'product_base_price': round(product_base_price, 2),  # Use base_price with profit margin
            'labor_cost': round(labor_cost, 2),
            'customization_fee': round(customization_fee, 2),
            'installation_charge': round(installation_charge, 2),
            'tax_amount': round(tax_amount, 2),
            'delivery_fee': round(delivery_fee, 2),
            'total_price': round(total_price, 2),
            'profit_margin_percent': round(fp.profit_margin_percent or 20.0, 2),
            'net_profit_amount': round(net_profit, 2),
            'materials_breakdown': materials_breakdown,
            'skills': skill_names,
            'estimated_hours': estimated_hours,
            'procurement_cost': round(procurement_cost, 2)
        }
    # Fallback: treat as raw product
    p = session.query(Product).filter_by(id=product_id).first()
    if not p:
        session.close()
        return {'error': 'Product not found'}
    base_price = (p.base_price or p.cost or 0) * quantity
    customization_fee = (p.customization_fee or 0) * quantity
    
    # Calculate transportation cost based on delivery address
    delivery_fee = calculate_transportation_cost(delivery_address)
    
    # Calculate installation charge based on total order value
    subtotal_before_installation = base_price + customization_fee
    if include_installation:
        if subtotal_before_installation < 80000:
            installation_charge = subtotal_before_installation * 0.10  # 10% for orders under 80k
        elif subtotal_before_installation <= 170000:
            installation_charge = subtotal_before_installation * 0.05  # 5% for orders between 80k and 170k
        else:
            installation_charge = subtotal_before_installation * 0.04  # 4% for orders over 170k
    else:
        installation_charge = 0
        
    tax_amount = 0.18 * (subtotal_before_installation + installation_charge)  # 18% GST
    total_price = subtotal_before_installation + installation_charge + delivery_fee + tax_amount
    procurement_cost = (p.procurement_cost or p.cost or 0) * quantity
    estimated_overheads = 0  # Placeholder for future logic
    net_profit = total_price - (procurement_cost + estimated_overheads)
    profit_margin_percent = (net_profit / total_price * 100) if total_price else 0
    session.close()
    return {
        'product_base_price': round(base_price, 2),
        'customization_fee': round(customization_fee, 2),
        'installation_charge': round(installation_charge, 2),
        'tax_amount': round(tax_amount, 2),
        'delivery_fee': round(delivery_fee, 2),
        'total_price': round(total_price, 2),
        'profit_margin_percent': round(profit_margin_percent, 2),
        'net_profit_amount': round(net_profit, 2)
    } 