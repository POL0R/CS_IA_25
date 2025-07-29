from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy.orm import sessionmaker
from db_init import get_engine
from models import (
    Product, Transaction, User, Batch, Customer, Order, OrderItem, OrderStatus, 
    Supplier, Warehouse, Project, ProjectRequirement, Employee, EmployeeAssignment, 
    ProjectStatus, Requisition, RequisitionStatus, Skill, FinishedProduct, 
    FinishedProductSkill, FinishedProductMaterial, CustomerRequest, 
    CustomerRequestStatus, ProjectOrder, AuditLog, SupplierProduct, SupplierRequest, 
    SupplierRequestItem, SupplierInvoice, SupplierInvoiceItem, SupplierRequestStatus, 
    SupplierInvoiceStatus, WarehouseRequest, WarehouseRequestItem, SupplierQuote, 
    SupplierQuoteItem, WarehouseRequestStatus, SupplierQuoteStatus, CompanyHoliday,
    ProjectTask, ProjectTaskDependency, ProjectTaskMaterial, Feature, ComplianceTag, ApplicationTag,
    SupplierRequestQuote, SupplierNegotiation, SupplierNegotiationItem, TransactionType,
    CustomerNegotiation, CustomerNegotiationItem
)
from flask_cors import CORS, cross_origin
from sqlalchemy import func, text
from datetime import datetime
import uuid
from project_timeline import calculate_project_end_date

# Add these imports for scraping and geocoding
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
import time
import os
import requests
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from math import radians, sin, cos, sqrt, atan2
from forecasting import stock_forecast_analysis
from aggregator import aggregate_requisitions, match_products_to_requirements, generate_price_breakdown, calculate_transportation_cost
from supplier_performance import get_supplier_performance_ui
from auth import verify_login
import re
import numpy as np
import difflib
from collections import Counter
from werkzeug.utils import secure_filename
import traceback
import random, string
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, Table
from sqlalchemy.orm import relationship
import json
import math
import logging
from pdf_generator import InvoicePDFGenerator
from tax_calculator import tax_calculator

# Helper: Geocode address to lat/lng using Mapbox
MAPBOX_TOKEN = os.environ.get('MAPBOX_TOKEN') or 'YOUR_MAPBOX_TOKEN'
def geocode_address(address):
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json?access_token={MAPBOX_TOKEN}"
    resp = requests.get(url)
    try:
        data = resp.json()
        print('Mapbox geocode response:', data)
        if 'features' in data and data['features']:
            lng, lat = data['features'][0]['center']
            return lat, lng
        else:
            print('No features found in geocode response')
            raise Exception('No geocoding result for address')
    except Exception as e:
        print('Error parsing geocode response:', str(e))
        raise Exception('Geocoding failed: ' + str(e))

# Helper: Calculate distance between two points using Haversine formula
def calculate_distance(lat1, lng1, lat2, lng2):
    R = 6371  # Earth's radius in kilometers
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c
    
    return distance

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    origin = request.headers.get('Origin')
    if origin and origin in ["http://localhost:5173"]:
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'product_photos')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Serve static files
@app.route('/static/product_photos/<filename>')
def serve_product_photo(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def get_bom_recursive(session, product, visited=None):
    if visited is None:
        visited = set()
    if product.id in visited:
        return []  # Prevent cycles
    visited.add(product.id)
    bom = []
    for comp in product.sub_components:
        child = comp.child
        entry = {
            'sku': child.sku,
            'name': child.name,
            'quantity': comp.quantity,
            'sub_components': get_bom_recursive(session, child, visited)
        }
        bom.append(entry)
    return bom

@app.route('/products/<sku>/bom', methods=['GET'])
def get_product_bom(sku):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    product = session.query(Product).filter_by(sku=sku).first()
    if not product:
        session.close()
        return jsonify({'error': 'Product not found'}), 404
    bom = get_bom_recursive(session, product)
    session.close()
    return jsonify({'sku': product.sku, 'name': product.name, 'bom': bom})

@app.route('/products', methods=['GET'])
@cross_origin()
def get_products():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    products = session.query(Product).all()
    result = []
    for p in products:
        # Ensure reorder_level and quantity are floats, default 0 if None
        reorder_level = p.reorder_level if p.reorder_level is not None else 0.0
        quantity = p.quantity if p.quantity is not None else 0.0
        # Calculate status
        if quantity == 0:
            status = 'out_of_stock'
        elif quantity <= reorder_level:
            status = 'low_stock'
        else:
            status = 'in_stock'
        result.append({
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'category': p.category,
            'quantity': quantity,
            'unit': p.unit,
            'cost': p.cost,
            'reorder_level': reorder_level,
            'supplier_id': p.supplier_id,
            'supplier_name': p.supplier.name if p.supplier_id and p.supplier else None,
            'email_sent_count': p.email_sent_count or 0,
            'status': status
        })
    session.close()
    return jsonify(result)

@app.route('/products', methods=['POST'])
def add_product():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        # Check for required fields
        required_fields = ['name', 'sku', 'category', 'quantity', 'unit', 'cost', 'reorder_level']
        for field in required_fields:
            if field not in data or data[field] in [None, '']:
                session.close()
                return jsonify({'error': f'Missing required field: {field}'}), 400
        # Check for unique SKU
        if session.query(Product).filter_by(sku=data['sku']).first():
            session.close()
            return jsonify({'error': 'SKU already exists'}), 400
        product = Product(
            name=data['name'],
            sku=data['sku'],
            category=data['category'],
            quantity=data['quantity'],
            unit=data['unit'],
            cost=data['cost'],
            reorder_level=data['reorder_level'],
            supplier_id=data.get('supplier_id'),
            photo_url=data.get('photo_url')
        )
        session.add(product)
        session.commit()
        session.close()
        return jsonify({'success': True}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/products/<int:product_id>/reset-email-count', methods=['POST'])
def reset_email_count(product_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        product = session.query(Product).filter_by(id=product_id).first()
        if not product:
            session.close()
            return jsonify({'error': 'Product not found'}), 404
        
        # Reset the email sent count to 0
        product.email_sent_count = 0
        session.commit()
        
        # Get the updated count before closing session
        updated_count = product.email_sent_count
        session.close()
        
        return jsonify({'success': True, 'email_sent_count': updated_count})
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/products/<int:product_id>/increment-email-count', methods=['POST'])
def increment_email_count(product_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        product = session.query(Product).filter_by(id=product_id).first()
        if not product:
            session.close()
            return jsonify({'error': 'Product not found'}), 404
        
        # Increment the email sent count
        product.email_sent_count = (product.email_sent_count or 0) + 1
        session.commit()
        
        # Get the updated count before closing session
        updated_count = product.email_sent_count
        session.close()
        
        return jsonify({'success': True, 'email_sent_count': updated_count})
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/products/<int:product_id>', methods=['PUT'])
def edit_product(product_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    product = session.query(Product).filter_by(id=product_id).first()
    if not product:
        session.close()
        return jsonify({'error': 'Product not found'}), 404
    for field in ['name', 'category', 'quantity', 'unit', 'cost', 'reorder_level', 'supplier_id']:
        if field in data:
            setattr(product, field, data[field])
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    product = session.query(Product).filter_by(id=product_id).first()
    if not product:
        session.close()
        return jsonify({'error': 'Product not found'}), 404
    session.delete(product)
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/transactions', methods=['GET'])
def get_transactions():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    transactions = session.query(Transaction).all()
    result = []
    for t in transactions:
        # Load related data before closing session
        product_name = None
        product_sku = None
        product_unit = None
        product_cost = None
        batch_number = None
        user_name = None
        supplier_name = None
        supplier_email = None
        customer_name = None
        
        if t.product:
            product_name = t.product.name
            product_sku = t.product.sku
            product_unit = t.product.unit
            product_cost = t.product.cost
        
        if t.batch:
            batch_number = t.batch.batch_id
        
        if t.user:
            user_name = t.user.username
        
        if t.supplier:
            supplier_name = t.supplier.name
            supplier_email = t.supplier.email
        if t.customer_id:
            customer = session.query(Customer).filter_by(id=t.customer_id).first()
            if customer:
                customer_name = customer.name
        
        result.append({
            'id': t.id,
            'type': t.type.value if t.type else None,
            'product_id': t.product_id,
            'product_name': product_name,
            'sku': product_sku,
            'quantity': t.quantity,
            'unit': product_unit,
            'batch_number': batch_number,
            'cost_per_unit': product_cost,
            'total_cost': (t.quantity * product_cost) if product_cost else None,
            'location': t.location,
            'date': t.date.isoformat() if t.date else None,
            'user': user_name,
            'supplier': supplier_name,
            'supplier_email': supplier_email,
            'customer': customer_name,
            'notes': t.note
        })
    session.close()
    return jsonify(result)

@app.route('/transactions', methods=['POST'])
def add_transaction():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get the product
        product = session.query(Product).filter_by(id=data['product_id']).first()
        if not product:
            session.close()
            return jsonify({'error': 'Product not found'}), 404
        
        # Validate stock out
        if data['type'] == 'stock_out':
            if product.quantity < data['quantity']:
                session.close()
                return jsonify({'error': f'Insufficient stock. Available: {product.quantity}, Requested: {data["quantity"]}'}), 400
        
        # Set supplier_id or customer_id
        supplier_id = data.get('supplier_id') if data['type'] == 'stock_in' else None
        customer_id = data.get('customer_id') if data['type'] == 'stock_out' else None
        
        # Create transaction
        transaction = Transaction(
            type=data['type'],
            product_id=data['product_id'],
            quantity=data['quantity'],
            location=data['location'],
            date=datetime.now(),
            user_id=1,  # Default user ID, would come from auth
            note=data.get('notes', ''),
            supplier_id=supplier_id,
            customer_id=customer_id
        )
        session.add(transaction)
        
        # Update product quantity
        if data['type'] == 'stock_in':
            product.quantity += data['quantity']
            # Reset email sent count if product is now above reorder level
            if product.quantity > (product.reorder_level or 0):
                product.email_sent_count = 0
        elif data['type'] == 'stock_out':
            product.quantity -= data['quantity']
        
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': 'Transaction processed successfully'}), 201
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/reports/kpis', methods=['GET'])
def get_kpis():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    total_products = session.query(func.count(Product.id)).scalar()
    total_value = session.query(func.sum(Product.quantity * Product.cost)).scalar() or 0
    low_stock_items = session.query(Product).filter(Product.quantity <= Product.reorder_level).count()
    out_of_stock_items = session.query(Product).filter(Product.quantity == 0).count()
    session.close()
    return jsonify({
        'totalProducts': total_products,
        'totalValue': total_value,
        'lowStockItems': low_stock_items,
        'outOfStockItems': out_of_stock_items
    })

@app.route('/reports/inventory', methods=['GET'])
def get_inventory_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    query = session.query(Product)
    # Only filter by date if Product.created_at exists
    # If not, ignore date filtering for inventory
    products = query.all()
    result = []
    for p in products:
        if p.quantity == 0:
            status = 'out_of_stock'
        elif p.quantity <= (p.reorder_level or 0):
            status = 'low_stock'
        else:
            status = 'in_stock'
        result.append({
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'category': p.category,
            'quantity': p.quantity,
            'unit': p.unit,
            'cost': p.cost,
            'reorder_level': p.reorder_level,
            'supplier_id': p.supplier_id,
            'supplier_name': p.supplier.name if p.supplier_id and p.supplier else None,
            'status': status
        })
    session.close()
    return jsonify(result)

@app.route('/reports/transactions', methods=['GET'])
def get_transactions_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    query = session.query(Transaction)
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.filter(Transaction.date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        query = query.filter(Transaction.date <= end_dt)
    transactions = query.all()
    result = []
    for t in transactions:
        # Load related data before closing session
        product_name = None
        product_sku = None
        product_unit = None
        product_cost = None
        batch_number = None
        user_name = None
        
        if t.product:
            product_name = t.product.name
            product_sku = t.product.sku
            product_unit = t.product.unit
            product_cost = t.product.cost
            
        if t.batch:
            batch_number = t.batch.batch_id
            
        if t.user:
            user_name = t.user.username
            
        result.append({
            'id': t.id,
            'type': t.type.value if t.type else None,
            'product_id': t.product_id,
            'product_name': product_name,
            'sku': product_sku,
            'quantity': t.quantity,
            'unit': product_unit,
            'batch_number': batch_number,
            'cost_per_unit': product_cost,
            'total_cost': (t.quantity * product_cost) if product_cost else None,
            'location': t.location,
            'date': t.date.isoformat() if t.date else None,
            'user': user_name,
            'notes': t.note
        })
    session.close()
    return jsonify(result)

@app.route('/reports/analytics', methods=['GET'])
def get_analytics_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    # Filter transactions by date for analytics
    tx_query = session.query(Transaction)
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        tx_query = tx_query.filter(Transaction.date >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        tx_query = tx_query.filter(Transaction.date <= end_dt)
    transactions = tx_query.all()
    # Category-wise stock value
    category_data = {}
    for row in session.query(Product.category, func.sum(Product.quantity * Product.cost)).group_by(Product.category):
        category, value = row
        key = str(category) if category is not None else 'Unknown'
        category_data[key] = value or 0
    # Supplier-wise stock value
    supplier_data = {}
    for row in session.query(Product.supplier_id, func.sum(Product.quantity * Product.cost)).group_by(Product.supplier_id):
        supplier_id, value = row
        supplier = session.query(Supplier).filter_by(id=supplier_id).first() if supplier_id else None
        supplier_name = supplier.name if supplier else None
        key = str(supplier_name) if supplier_name is not None else 'Unknown'
        supplier_data[key] = value or 0
    # Stock status distribution
    in_stock = session.query(Product).filter(Product.quantity > Product.reorder_level).count()
    low_stock = session.query(Product).filter(Product.quantity > 0, Product.quantity <= Product.reorder_level).count()
    out_of_stock = session.query(Product).filter(Product.quantity == 0).count()
    # Transaction summary
    total_transactions = session.query(Transaction).count()
    # Calculate stock in/out values by loading product data before session closure
    stock_in_transactions = session.query(Transaction).filter(Transaction.type == 'stock_in').all()
    stock_out_transactions = session.query(Transaction).filter(Transaction.type == 'stock_out').all()
    stock_in_value = 0
    stock_out_value = 0
    for t in stock_in_transactions:
        if t.product and t.product.cost:
            stock_in_value += (t.quantity * t.product.cost)
    for t in stock_out_transactions:
        if t.product and t.product.cost:
            stock_out_value += (t.quantity * t.product.cost)
    session.close()
    return jsonify({
        'categoryData': category_data,
        'supplierData': supplier_data,
        'stockStatus': {
            'in_stock': in_stock,
            'low_stock': low_stock,
            'out_of_stock': out_of_stock
        },
        'transactionSummary': {
            'totalTransactions': total_transactions,
            'stockInValue': stock_in_value,
            'stockOutValue': stock_out_value
        }
    })

# Customer endpoints
@app.route('/customers', methods=['GET'])
def get_customers():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    customers = session.query(Customer).all()
    result = []
    for c in customers:
        result.append({
            'id': c.id,
            'name': c.name,
            'email': c.email,
            'phone': c.phone,
            'address': c.address,
            'company': c.company,
            'tax_id': c.tax_id,
            'credit_limit': c.credit_limit,
            'created_at': c.created_at.isoformat() if c.created_at else None,
            'updated_at': c.updated_at.isoformat() if c.updated_at else None
        })
    session.close()
    return jsonify(result)

@app.route('/customers', methods=['POST'])
@cross_origin()
def add_customer():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    customer = Customer(
        name=data['name'],
        email=data.get('email'),
        phone=data.get('phone'),
        address=data.get('address'),
        company=data.get('company'),
        tax_id=data.get('tax_id'),
        credit_limit=data.get('credit_limit', 0.0),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    session.add(customer)
    session.commit()
    customer_id = customer.id  # <-- FIX: get id before closing session
    session.close()
    return jsonify({'success': True, 'customer_id': customer_id}), 201

@app.route('/customers/<int:customer_id>', methods=['PUT'])
@cross_origin()
def update_customer(customer_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    customer = session.query(Customer).filter_by(id=customer_id).first()
    if not customer:
        session.close()
        return jsonify({'error': 'Customer not found'}), 404
    
    customer.name = data.get('name', customer.name)
    customer.email = data.get('email', customer.email)
    customer.phone = data.get('phone', customer.phone)
    customer.address = data.get('address', customer.address)
    customer.company = data.get('company', customer.company)
    customer.tax_id = data.get('tax_id', customer.tax_id)
    customer.credit_limit = data.get('credit_limit', customer.credit_limit)
    customer.updated_at = datetime.now()
    
    session.commit()
    session.close()
    return jsonify({'success': True})

# Supplier endpoints
@app.route('/suppliers', methods=['GET'])
def get_suppliers():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    suppliers = session.query(Supplier).all()
    result = []
    for s in suppliers:
        result.append({
            'id': s.id,
            'name': s.name,
            'email': s.email,
            'phone': s.phone,
            'address': s.address,
            'company': s.company,
            'tax_id': s.tax_id,
            'lat': s.lat,
            'lng': s.lng,
            'created_at': s.created_at.isoformat() if s.created_at else None,
            'updated_at': s.updated_at.isoformat() if s.updated_at else None,
            'is_spam': getattr(s, 'is_spam', False),
            'banned_email': getattr(s, 'banned_email', False),
            'registration_complete': getattr(s, 'registration_complete', False)
        })
    session.close()
    return jsonify(result)

@cross_origin()
@app.route('/suppliers', methods=['POST'])
def add_supplier():
    data = request.json
    print('DEBUG: Supplier onboarding data:', data)
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    # Only check for duplicate email in Supplier table
    if session.query(Supplier).filter_by(email=data.get('email')).first():
        session.close()
        return jsonify({'error': 'This email is already registered as a supplier.'}), 409
    # Normal creation
    supplier = Supplier(
        name=data['name'],
        email=data.get('email'),
        phone=data.get('phone'),
        address=data.get('address'),
        company=data.get('company'),
        tax_id=data.get('tax_id'),
        lat=data.get('lat'),
        lng=data.get('lng'),
        created_at=datetime.now(),
        updated_at=datetime.now(),
        registration_complete=data.get('registration_complete', False)
    )
    session.add(supplier)
    session.commit()
    print('DEBUG: Supplier saved:', supplier.id, supplier.name, supplier.address, supplier.lat, supplier.lng)
    supplier_id = supplier.id
    # Do NOT create products/materials here. All supplier-material links should be created via /supplier-products endpoint.
    session.close()
    return jsonify({'success': True, 'supplier_id': supplier_id}), 201

@app.route('/suppliers/<int:supplier_id>', methods=['PUT'])
def update_supplier(supplier_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    supplier = session.query(Supplier).filter_by(id=supplier_id).first()
    if not supplier:
        session.close()
        return jsonify({'error': 'Supplier not found'}), 404
    supplier.name = data.get('name', supplier.name)
    supplier.email = data.get('email', supplier.email)
    supplier.phone = data.get('phone', supplier.phone)
    supplier.address = data.get('address', supplier.address)
    supplier.company = data.get('company', supplier.company)
    supplier.tax_id = data.get('tax_id', supplier.tax_id)
    supplier.lat = data.get('lat', supplier.lat)
    supplier.lng = data.get('lng', supplier.lng)
    supplier.updated_at = datetime.now()
    supplier.registration_complete = data.get('registration_complete', supplier.registration_complete if hasattr(supplier, 'registration_complete') else False)
    session.commit()
    updated_products = []
    if 'products' in data:
        for p in data['products']:
            sku = p.get('sku') or f"SUP{supplier.id}-{p['name'][:3].upper()}-{int(datetime.now().timestamp())}"
            product = Product(
                name=p['name'],
                sku=sku,
                category=p.get('category'),
                quantity=p.get('quantity', 0),
                unit=p.get('unit', 'units'),
                cost=p.get('cost', 0),
                reorder_level=p.get('reorder_level', 0),
                supplier_id=supplier.id,
                photo_url=p.get('photo_url')
            )
            session.add(product)
            session.flush()
            updated_products.append({
                'id': product.id,
                'name': product.name,
                'sku': product.sku,
                'category': product.category,
                'photo_url': product.photo_url
            })
        session.commit()
    session.close()
    return jsonify({'success': True, 'products': updated_products}), 200

@app.route('/suppliers/<int:supplier_id>', methods=['DELETE'])
def delete_supplier(supplier_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    supplier = session.query(Supplier).filter_by(id=supplier_id).first()
    if not supplier:
        session.close()
        return jsonify({'error': 'Supplier not found'}), 404
    session.delete(supplier)
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/suppliers/performance', methods=['GET'])
def get_suppliers_performance():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    products = session.query(Product).all()
    result = []
    for p in products:
        # Find all suppliers who have supplied this product (via stock_in transactions)
        txs = (
            session.query(Transaction)
            .filter(Transaction.product_id == p.id, Transaction.type == 'stock_in')
            .order_by(Transaction.supplier_id, Transaction.date.asc())
            .all()
        )
        supplier_map = {}
        for t in txs:
            if not t.supplier:
                continue
            sid = t.supplier.id
            if sid not in supplier_map:
                supplier_map[sid] = {
                    'id': t.supplier.id,
                    'name': t.supplier.name,
                    'email': t.supplier.email,
                    'phone': t.supplier.phone,
                    'address': t.supplier.address,
                    'company': t.supplier.company,
                    'txs': []
                }
            supplier_map[sid]['txs'].append(t)
        suppliers_perf = []
        for s in supplier_map.values():
            txs = s['txs']
            prices = [t.product.cost if t.product and t.product.cost else t.note and float(t.note) or 0 for t in txs]
            avg_price = round(sum(prices) / len(prices), 2) if prices else 0.0
            lead_times = []
            on_time = 0
            total = 0
            rejected = 0
            ordered = 0
            for t in txs:
                lead_time = None
                if t.note and 'lead_time=' in t.note:
                    try:
                        lead_time = float(t.note.split('lead_time=')[1].split()[0])
                    except Exception:
                        pass
                if lead_time is not None:
                    lead_times.append(lead_time)
                    if lead_time <= 5:
                        on_time += 1
                    total += 1
                if t.note and 'rejected=' in t.note:
                    try:
                        rejected += int(t.note.split('rejected=')[1].split()[0])
                    except Exception:
                        pass
                ordered += t.quantity or 0
            avg_lead_time = round(sum(lead_times) / len(lead_times), 2) if lead_times else 0.0
            on_time_rate = round(100 * on_time / total, 1) if total else 0.0
            rejection_rate = round(100 * rejected / ordered, 2) if ordered else 0.0
            score = (
                0.4 * (on_time_rate / 100) +
                0.2 * (1 - (avg_price / max(prices) if prices and max(prices) else 0)) +
                0.2 * (1 - rejection_rate / 100) +
                0.2 * (1 - avg_lead_time / (max(lead_times) if lead_times else 1))
            ) * 10
            score = round(score, 2)
            suppliers_perf.append({
                'id': s['id'],
                'name': s['name'],
                'avg_price': avg_price,
                'on_time_rate': on_time_rate,
                'rejection_rate': rejection_rate,
                'avg_lead_time': avg_lead_time,
                'score': score,
                'email': s['email'],
                'phone': s['phone'],
                'address': s['address'],
                'company': s['company'],
            })
        suppliers_perf.sort(key=lambda x: (-x['score'], x['avg_price'], x['avg_lead_time']))
        result.append({
            'product_id': p.id,
            'product_name': p.name,
            'product_sku': p.sku,
            'suppliers': suppliers_perf,
            'no_data': len(suppliers_perf) == 0
        })
    session.close()
    return jsonify(result)

@app.route('/suppliers/<int:supplier_id>/flag_spam', methods=['POST'])
def flag_supplier_spam(supplier_id):
    # Only admin should be able to call this (add real auth in production)
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    supplier = session.query(Supplier).filter_by(id=supplier_id).first()
    if not supplier:
        session.close()
        return jsonify({'error': 'Supplier not found'}), 404
    supplier.is_spam = True
    # Also flag user as spam if exists
    user = session.query(User).filter_by(email=supplier.email).first()
    if user:
        user.is_spam = True
    session.commit()
    session.close()
    return jsonify({'success': True, 'message': 'Supplier flagged as spam'})

@app.route('/suppliers/<int:supplier_id>/ban', methods=['POST'])
def ban_supplier_email(supplier_id):
    # Only admin should be able to call this (add real auth in production)
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    supplier = session.query(Supplier).filter_by(id=supplier_id).first()
    if not supplier:
        session.close()
        return jsonify({'error': 'Supplier not found'}), 404
    supplier.banned_email = True
    supplier.is_spam = True
    # Also ban user if exists
    user = session.query(User).filter_by(email=supplier.email).first()
    if user:
        user.banned_email = True
        user.is_spam = True
    # Optionally, delete user account
    if user:
        session.delete(user)
    session.commit()
    session.delete(supplier)
    session.commit()
    session.close()
    return jsonify({'success': True, 'message': 'Supplier and user deleted and email banned'})

# Order endpoints
@app.route('/orders', methods=['GET'])
def get_orders():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    orders = session.query(Order).all()
    result = []
    for o in orders:
        # Load related data before closing session
        customer_name = None
        customer_email = None
        user_name = None
        
        if o.customer:
            customer_name = o.customer.name
            customer_email = o.customer.email
            
        if o.user:
            user_name = o.user.username
            
        result.append({
            'id': o.id,
            'order_number': o.order_number,
            'customer_id': o.customer_id,
            'customer_name': customer_name,
            'customer_email': customer_email,
            'user_id': o.user_id,
            'user_name': user_name,
            'status': o.status.value if o.status else None,
            'order_date': o.order_date.isoformat() if o.order_date else None,
            'delivery_date': o.delivery_date.isoformat() if o.delivery_date else None,
            'proposed_deadline': o.proposed_deadline.isoformat() if o.proposed_deadline else None,
            'delivery_address': o.delivery_address,
            'total_amount': o.total_amount,
            'notes': o.notes,
            'created_at': o.created_at.isoformat() if o.created_at else None,
            'updated_at': o.updated_at.isoformat() if o.updated_at else None
        })
    session.close()
    return jsonify(result)

@app.route('/orders', methods=['POST'])
def create_order():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Generate unique order number
        order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Parse proposed deadline if provided
        proposed_deadline = None
        if data.get('proposed_deadline'):
            try:
                proposed_deadline = datetime.fromisoformat(data['proposed_deadline'].replace('Z', '+00:00'))
            except:
                proposed_deadline = None
        
        order = Order(
            order_number=order_number,
            customer_id=data['customer_id'],
            user_id=1,  # Default user ID, would come from auth
            status=OrderStatus.pending,
            order_date=datetime.now(),
            delivery_date=data.get('delivery_date'),
            proposed_deadline=proposed_deadline,  # New field for customer's proposed deadline
            delivery_address=data.get('delivery_address'),  # New field for delivery location
            total_amount=0.0,  # Will be calculated from items
            notes=data.get('notes'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(order)
        session.flush()  # Get the order ID
        
        # Add order items and immediately deduct stock + create transaction
        total_amount = 0.0
        for item_data in data.get('items', []):
            product = session.query(Product).filter_by(id=item_data['product_id']).with_for_update().first()
            if not product:
                session.rollback()
                session.close()
                return jsonify({'error': f"Product with ID {item_data['product_id']} not found"}), 400
            
            unit_price = item_data.get('unit_price', product.cost or 0.0)
            quantity = item_data['quantity']
            total_price = unit_price * quantity
            total_amount += total_price
            
            # Check stock availability
            if product.quantity < quantity:
                session.rollback()
                session.close()
                return jsonify({'error': f'Insufficient stock for {product.name}. Available: {product.quantity}, Requested: {quantity}'}), 400
            
            # Deduct stock
            product.quantity -= quantity
            
            # Create stock out transaction
            transaction = Transaction(
                type='stock_out',
                product_id=product.id,
                quantity=quantity,
                location='Main Warehouse',  # Default location
                date=datetime.now(),
                user_id=1,  # Default user ID
                note=f"Order {order_number} - {item_data.get('notes', '')}",
                customer_id=data['customer_id']
            )
            session.add(transaction)
            
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                notes=item_data.get('notes')
            )
            session.add(order_item)
        
        # Update order total
        order.total_amount = total_amount
        session.commit()
        order_id = order.id  # <-- get id before closing session
        order_number = order.order_number  # <-- get order_number before closing session
        session.close()
        return jsonify({'success': True, 'order_id': order_id, 'order_number': order_number}), 201
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        order = session.query(Order).filter_by(id=order_id).first()
        if not order:
            session.close()
            return jsonify({'error': 'Order not found'}), 404
        
        # Update order details
        if 'status' in data:
            order.status = OrderStatus(data['status'])
        if 'delivery_date' in data:
            order.delivery_date = datetime.fromisoformat(data['delivery_date']) if data['delivery_date'] else None
        if 'proposed_deadline' in data:
            order.proposed_deadline = datetime.fromisoformat(data['proposed_deadline']) if data['proposed_deadline'] else None
        if 'delivery_address' in data:
            order.delivery_address = data['delivery_address']
        if 'notes' in data:
            order.notes = data['notes']
        order.updated_at = datetime.now()
        
        # Update items if provided
        if 'items' in data:
            # Remove existing items
            session.query(OrderItem).filter_by(order_id=order_id).delete()
            
            # Add new items
            total_amount = 0.0
            for item_data in data['items']:
                product = session.query(Product).filter_by(id=item_data['product_id']).first()
                if not product:
                    continue
                    
                unit_price = item_data.get('unit_price', product.cost or 0.0)
                quantity = item_data['quantity']
                total_price = unit_price * quantity
                total_amount += total_price
                
                order_item = OrderItem(
                    order_id=order_id,
                    product_id=item_data['product_id'],
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    notes=item_data.get('notes')
                )
                session.add(order_item)
            
            order.total_amount = total_amount
        
        session.commit()
        session.close()
        return jsonify({'success': True})
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/orders/<int:order_id>/items', methods=['GET'])
def get_order_items(order_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    order_items = session.query(OrderItem).filter_by(order_id=order_id).all()
    result = []
    for item in order_items:
        # Load related data before closing session
        product_name = None
        product_sku = None
        
        if item.product:
            product_name = item.product.name
            product_sku = item.product.sku
            
        result.append({
            'id': item.id,
            'product_id': item.product_id,
            'product_name': product_name,
            'product_sku': product_sku,
            'quantity': item.quantity,
            'unit_price': item.unit_price,
            'total_price': item.total_price,
            'notes': item.notes
        })
    session.close()
    return jsonify(result)

@app.route('/orders/<int:order_id>/process', methods=['POST'])
def process_order(order_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        order = session.query(Order).filter_by(id=order_id).first()
        if not order:
            session.close()
            return jsonify({'error': 'Order not found'}), 404
        
        # Get order number before any potential session closure
        order_number = order.order_number
        
        # Get order items
        order_items = session.query(OrderItem).filter_by(order_id=order_id).all()
        
        # Process each item (create stock out transactions)
        for item in order_items:
            product = item.product
            if not product:
                continue
            
            # Get product name before any potential session closure
            product_name = product.name
            
            # Check if enough stock is available
            if product.quantity < item.quantity:
                session.close()
                return jsonify({'error': f'Insufficient stock for {product_name}. Available: {product.quantity}, Required: {item.quantity}'}), 400
            
            # Create stock out transaction
            transaction = Transaction(
                type='stock_out',
                product_id=item.product_id,
                quantity=item.quantity,
                location='Main Warehouse',  # Default location
                date=datetime.now(),
                user_id=1,  # Default user ID
                note=f"Order {order_number} - {item.notes or ''}"
            )
            session.add(transaction)
            
            # Update product quantity
            product.quantity -= item.quantity
        
        # Update order status
        order.status = OrderStatus.processing
        order.updated_at = datetime.now()
        
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': 'Order processed successfully'})
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/orders/<int:order_id>/price-breakdown', methods=['GET'])
@cross_origin()
def get_order_price_breakdown(order_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        order = session.query(Order).filter_by(id=order_id).first()
        if not order:
            session.close()
            return jsonify({'error': 'Order not found'}), 404
        
        # Get order items
        order_items = session.query(OrderItem).filter_by(order_id=order_id).all()
        if not order_items:
            session.close()
            return jsonify({'error': 'No items found for this order'}), 404
        
        # Generate comprehensive price breakdown for all items
        try:
            total_product_base_price = 0
            total_labor_cost = 0
            total_customization_fee = 0
            total_installation_charge = 0
            total_tax_amount = 0
            total_delivery_fee = 0
            total_procurement_cost = 0
            all_materials_breakdown = []
            all_skills = set()
            total_estimated_hours = 0
            total_quantity = 0  # Track total quantity across all items
            
            # Calculate delivery fee once for the entire order
            delivery_fee = calculate_transportation_cost(order.delivery_address or "")
            
            for item in order_items:
                item_breakdown = generate_price_breakdown(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    include_installation=False,
                    delivery_address=order.delivery_address or ""
                )
                
                # Aggregate costs
                total_product_base_price += item_breakdown.get('product_base_price', 0)
                total_labor_cost += item_breakdown.get('labor_cost', 0)
                total_customization_fee += item_breakdown.get('customization_fee', 0)
                total_installation_charge += item_breakdown.get('installation_charge', 0)
                total_procurement_cost += item_breakdown.get('procurement_cost', 0)
                
                # Aggregate total quantity
                total_quantity += item.quantity
                
                # Aggregate materials breakdown
                if item_breakdown.get('materials_breakdown'):
                    all_materials_breakdown.extend(item_breakdown['materials_breakdown'])
                
                # Aggregate skills
                if item_breakdown.get('skills'):
                    all_skills.update(item_breakdown['skills'])
                
                # Aggregate estimated hours
                total_estimated_hours += item_breakdown.get('estimated_hours', 0)
            
            # Calculate total tax and final price
            subtotal_before_tax = total_product_base_price + total_labor_cost + total_customization_fee + total_installation_charge
            total_tax_amount = subtotal_before_tax * 0.18
            total_price = subtotal_before_tax + total_tax_amount + delivery_fee
            
            # Calculate profit margin
            total_overheads = 0  # Placeholder for future logic
            net_profit = total_price - (total_procurement_cost + total_labor_cost + total_overheads)
            profit_margin_percent = (net_profit / total_price * 100) if total_price else 0
            
            # Create comprehensive price breakdown
            price_breakdown = {
                'product_base_price': total_product_base_price,
                'labor_cost': total_labor_cost,
                'customization_fee': total_customization_fee,
                'installation_charge': total_installation_charge,
                'tax_amount': total_tax_amount,
                'delivery_fee': delivery_fee,
                'total_price': total_price,
                'profit_margin_percent': round(profit_margin_percent, 2),
                'net_profit_amount': net_profit,
                'materials_breakdown': all_materials_breakdown,
                'skills': list(all_skills),
                'estimated_hours': total_estimated_hours,
                'procurement_cost': total_procurement_cost,
                'items_count': len(order_items),
                'total_quantity': total_quantity
            }
            
            # Add order-specific information
            price_breakdown['order_number'] = order.order_number
            price_breakdown['order_date'] = order.order_date.isoformat() if order.order_date else None
            price_breakdown['proposed_deadline'] = order.proposed_deadline.isoformat() if order.proposed_deadline else None
            price_breakdown['delivery_address'] = order.delivery_address
            price_breakdown['order_status'] = order.status.value if order.status else None
            
            session.close()
            return jsonify(price_breakdown)
            
        except Exception as e:
            print(f"Error generating price breakdown: {e}")
            # Return basic breakdown if detailed calculation fails
            total_base_price = sum(item.unit_price * item.quantity for item in order_items)
            total_tax = total_base_price * 0.18
            delivery_fee = calculate_transportation_cost(order.delivery_address or "")
            total_quantity = sum(item.quantity for item in order_items)
            
            session.close()
            return jsonify({
                'product_base_price': total_base_price,
                'labor_cost': 0,
                'customization_fee': 0,
                'installation_charge': 0,
                'tax_amount': total_tax,
                'delivery_fee': delivery_fee,
                'total_price': order.total_amount or (total_base_price + total_tax + delivery_fee),
                'profit_margin_percent': 0,
                'net_profit_amount': 0,
                'materials_breakdown': [],
                'skills': [],
                'estimated_hours': 0,
                'procurement_cost': 0,
                'items_count': len(order_items),
                'total_quantity': total_quantity,
                'order_number': order.order_number,
                'order_date': order.order_date.isoformat() if order.order_date else None,
                'proposed_deadline': order.proposed_deadline.isoformat() if order.proposed_deadline else None,
                'delivery_address': order.delivery_address,
                'order_status': order.status.value if order.status else None
            })
        
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/warehouses', methods=['GET'])
def get_warehouses():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    warehouses = session.query(Warehouse).all()
    result = []
    for w in warehouses:
        result.append({
            'id': w.id,
            'name': w.name,
            'location': w.location,
            'lat': w.lat,
            'lng': w.lng
        })
    session.close()
    return jsonify(result)

@app.route('/warehouses', methods=['POST'])
def add_warehouse():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        warehouse = Warehouse(
            name=data['name'],
            location=data['location'],
            lat=data.get('lat'),
            lng=data.get('lng')
        )
        session.add(warehouse)
        session.commit()
        warehouse_id = warehouse.id
        session.close()
        return jsonify({'success': True, 'warehouse_id': warehouse_id}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/warehouses/<int:warehouse_id>', methods=['PUT'])
def update_warehouse(warehouse_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    warehouse = session.query(Warehouse).get(warehouse_id)
    if not warehouse:
        session.close()
        return jsonify({'error': 'Warehouse not found'}), 404
    data = request.json
    warehouse.name = data.get('name', warehouse.name)
    warehouse.location = data.get('location', warehouse.location)
    # Save coordinates if provided
    if 'lat' in data:
        warehouse.lat = data['lat']
    if 'lng' in data:
        warehouse.lng = data['lng']
    session.commit()
    session.close()
    return jsonify({'message': 'Warehouse updated'})

# ===== PROJECT MANAGEMENT ENDPOINTS =====

@app.route('/projects', methods=['GET'])
@cross_origin()
def get_projects():
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        projects = session.query(Project).all()
        result = []
        for p in projects:
            # Calculate total cost from requirements
            total_cost = 0
            requirements = getattr(p, 'requirements', []) or []
            for req in requirements:
                product = getattr(req, 'product', None)
                cost = getattr(product, 'cost', 0) if product else 0
                total_cost += (getattr(req, 'quantity_required', 0) or 0) * (cost or 0)
            project_manager = getattr(p, 'project_manager', None)
            project_manager_name = getattr(project_manager, 'username', None) if project_manager else None
            result.append({
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'project_manager_id': p.project_manager_id,
                'project_manager_name': project_manager_name,
                'status': p.status if p.status else None,
                'priority': p.priority,
                'budget': p.budget,
                'start_date': p.start_date.isoformat() if p.start_date else None,
                'deadline': p.deadline.isoformat() if p.deadline else None,
                'location': p.location,
                'lat': p.lat,
                'lng': p.lng,
                'transportation_cost': p.transportation_cost,
                'total_cost': (total_cost or 0) + (p.transportation_cost or 0),
                'progress': p.progress,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'updated_at': p.updated_at.isoformat() if p.updated_at else None,
                'requirements_count': len(requirements),
                'assignments_count': len(getattr(p, 'assignments', []) or [])
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        response = jsonify({'error': str(e)})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 500

@app.route('/projects', methods=['POST'])
def create_project():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        project = Project(
            name=data['name'],
            description=data.get('description', ''),
            project_manager_id=data.get('project_manager_id'),
            status=ProjectStatus.planning,
            priority=data.get('priority', 'medium'),
            budget=data.get('budget', 0.0),
            start_date=datetime.fromisoformat(data['start_date']) if data.get('start_date') else None,
            deadline=datetime.fromisoformat(data['deadline']) if data.get('deadline') else None,
            location=data.get('location', ''),
            lat=data.get('lat'),
            lng=data.get('lng'),
            transportation_cost=data.get('transportation_cost', 0.0),
            total_cost=0.0,
            progress=0.0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(project)
        session.commit()
        project_id = project.id
        # Delegate employees if provided
        delegate_employees = data.get('delegate_employees', [])
        for emp_id in delegate_employees:
            assignment = EmployeeAssignment(
                project_id=project_id,
                employee_id=emp_id,
                assigned_hours=10,  # Default hours, can be customized
                actual_hours=0,
                role='Team Member',
                start_date=project.start_date,
                end_date=project.deadline,
                is_active=True,
                performance_rating=0.0,
                notes='Auto-assigned on project creation',
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            session.add(assignment)
        session.commit()
        session.close()
        return jsonify({'success': True, 'project_id': project_id}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        session.close()
        return jsonify({'error': 'Project not found'}), 404
    
    # Get requirements
    requirements = []
    for req in project.requirements:
        requirements.append({
            'id': req.id,
            'product_id': req.product_id,
            'product_name': req.product.name if req.product else None,
            'product_sku': req.product.sku if req.product else None,
            'quantity_required': req.quantity_required,
            'quantity_ordered': req.quantity_ordered,
            'quantity_received': req.quantity_received,
            'specifications': req.specifications,
            'priority': req.priority,
            'is_ordered': req.is_ordered,
            'stock_available': req.product.quantity if req.product else 0,
            'needs_ordering': req.quantity_required > (req.product.quantity if req.product else 0)
        })
    
    # Get assignments
    assignments = []
    for assignment in project.assignments:
        assignments.append({
            'id': assignment.id,
            'employee_id': assignment.employee_id,
            'employee_name': f"{assignment.employee.first_name} {assignment.employee.last_name}" if assignment.employee else None,
            'assigned_hours': assignment.assigned_hours,
            'actual_hours': assignment.actual_hours,
            'role': assignment.role,
            'start_date': assignment.start_date.isoformat() if assignment.start_date else None,
            'end_date': assignment.end_date.isoformat() if assignment.end_date else None,
            'is_active': assignment.is_active,
            'performance_rating': assignment.performance_rating
        })
    
    result = {
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'project_manager_id': project.project_manager_id,
        'project_manager_name': project.project_manager.username if project.project_manager else None,
        'status': project.status if project.status else None,
        'priority': project.priority,
        'budget': project.budget,
        'start_date': project.start_date.isoformat() if project.start_date else None,
        'deadline': project.deadline.isoformat() if project.deadline else None,
        'location': project.location,
        'transportation_cost': project.transportation_cost,
        'total_cost': project.total_cost,
        'progress': project.progress,
        'created_at': project.created_at.isoformat() if project.created_at else None,
        'updated_at': project.updated_at.isoformat() if project.updated_at else None,
        'requirements': requirements,
        'assignments': assignments
    }
    
    session.close()
    return jsonify(result)

@app.route('/projects/<int:project_id>/requirements', methods=['POST'])
def add_project_requirement(project_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        requirement = ProjectRequirement(
            project_id=project_id,
            product_id=data['product_id'],
            quantity_required=data['quantity_required'],
            quantity_ordered=0,
            quantity_received=0,
            specifications=data.get('specifications', ''),
            priority=data.get('priority', 'normal'),
            is_ordered=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(requirement)
        session.commit()
        requirement_id = requirement.id
        session.close()
        return jsonify({'success': True, 'requirement_id': requirement_id}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/employees', methods=['GET'])
def get_employees():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    employees = session.query(Employee).all()
    result = []
    for emp in employees:
        # Calculate current workload from active assignments
        current_workload = 0
        for assignment in emp.assignments:
            if assignment.is_active:
                current_workload += assignment.assigned_hours
        
        result.append({
            'id': emp.id,
            'user_id': emp.user_id,
            'first_name': emp.first_name,
            'last_name': emp.last_name,
            'email': emp.email,
            'phone': emp.phone,
            'skills': emp.skills,
            'hourly_rate': emp.hourly_rate,
            'efficiency_rating': emp.efficiency_rating,
            'max_workload': emp.max_workload,
            'current_workload': current_workload,
            'available_hours': emp.max_workload - current_workload,
            'location': emp.location,
            'is_available': emp.is_available,
            'created_at': emp.created_at.isoformat() if emp.created_at else None,
            'updated_at': emp.updated_at.isoformat() if emp.updated_at else None
        })
    session.close()
    return jsonify(result)

@app.route('/employees', methods=['POST'])
def create_employee():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        employee = Employee(
            user_id=data.get('user_id'),
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            phone=data.get('phone', ''),
            skills=data.get('skills', '[]'),
            hourly_rate=data.get('hourly_rate', 0.0),
            efficiency_rating=data.get('efficiency_rating', 1.0),
            max_workload=data.get('max_workload', 40.0),
            current_workload=0.0,
            location=data.get('location', ''),
            is_available=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(employee)
        session.commit()
        employee_id = employee.id
        session.close()
        return jsonify({'success': True, 'employee_id': employee_id}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/projects/<int:project_id>/suggest-employees', methods=['GET'])
def suggest_employees(project_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        session.close()
        return jsonify({'error': 'Project not found'}), 404
    # Get all available employees
    employees = session.query(Employee).filter(Employee.is_available == True).all()
    suggestions = []
    for emp in employees:
        current_workload = 0
        for assignment in emp.assignments:
            if assignment.is_active:
                current_workload += assignment.assigned_hours
        available_hours = emp.max_workload - current_workload
        cost_efficiency = emp.hourly_rate / emp.efficiency_rating
        location_bonus = 1.2 if emp.location == project.location else 1.0
        overall_score = (emp.efficiency_rating * location_bonus) / emp.hourly_rate
        if available_hours > 0:
            suggestions.append({
                'employee_id': emp.id,
                'name': f"{emp.first_name} {emp.last_name}",
                'email': emp.email,
                'skills': emp.skills,
                'hourly_rate': emp.hourly_rate,
                'efficiency_rating': emp.efficiency_rating,
                'current_workload': current_workload,
                'available_hours': available_hours,
                'location': emp.location,
                'cost_efficiency': cost_efficiency,
                'overall_score': overall_score,
                'recommended_hours': min(available_hours, 20.0),
                'location_match': emp.location == project.location
            })
    suggestions.sort(key=lambda x: x['overall_score'], reverse=True)
    if not suggestions:
        if not employees:
            reason = 'No employees are marked as available.'
        elif all((emp.max_workload - sum(a.assigned_hours for a in emp.assignments if a.is_active)) <= 0 for emp in employees):
            reason = 'All available employees are fully booked (no available hours).'
        else:
            reason = 'No employees meet the criteria for suggestion.'
        session.close()
        return jsonify({'suggestions': [], 'reason': reason})
    session.close()
    return jsonify({'suggestions': suggestions, 'reason': ''})

@app.route('/projects/<int:project_id>/suggest-orders', methods=['GET'])
def suggest_orders(project_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        session.close()
        return jsonify({'error': 'Project not found'}), 404
    
    suggestions = []
    
    for req in project.requirements:
        if req.product:
            stock_available = req.product.quantity
            quantity_needed = req.quantity_required - stock_available
            
            if quantity_needed > 0:
                # Calculate order suggestions
                order_suggestions = []
                
                # Option 1: Order exactly what's needed
                order_suggestions.append({
                    'type': 'exact_need',
                    'quantity': quantity_needed,
                    'cost': quantity_needed * req.product.cost,
                    'description': f'Order exactly {quantity_needed} units to meet requirement'
                })
                
                # Option 2: Order with buffer (20% extra)
                buffer_quantity = int(quantity_needed * 1.2)
                order_suggestions.append({
                    'type': 'with_buffer',
                    'quantity': buffer_quantity,
                    'cost': buffer_quantity * req.product.cost,
                    'description': f'Order {buffer_quantity} units (20% buffer)'
                })
                
                # Option 3: Order in bulk (if supplier offers discounts)
                bulk_quantity = max(quantity_needed, 50)  # Minimum bulk order
                bulk_cost = bulk_quantity * req.product.cost * 0.9  # 10% bulk discount
                order_suggestions.append({
                    'type': 'bulk_order',
                    'quantity': bulk_quantity,
                    'cost': bulk_cost,
                    'description': f'Bulk order {bulk_quantity} units (10% discount)'
                })
                
                suggestions.append({
                    'requirement_id': req.id,
                    'product_id': req.product_id,
                    'product_name': req.product.name,
                    'product_sku': req.product.sku,
                    'quantity_required': req.quantity_required,
                    'stock_available': stock_available,
                    'quantity_needed': quantity_needed,
                    'priority': req.priority,
                    'supplier': req.product.supplier,
                    'unit_cost': req.product.cost,
                    'order_suggestions': order_suggestions
                })
    
    session.close()
    return jsonify(suggestions)

@app.route('/projects/<int:project_id>/assign-employee', methods=['POST'])
def assign_employee(project_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        assignment = EmployeeAssignment(
            project_id=project_id,
            employee_id=data['employee_id'],
            assigned_hours=data['assigned_hours'],
            actual_hours=0,
            role=data.get('role', 'Team Member'),
            start_date=datetime.fromisoformat(data['start_date']) if data.get('start_date') else None,
            end_date=datetime.fromisoformat(data['end_date']) if data.get('end_date') else None,
            is_active=True,
            performance_rating=0.0,
            notes=data.get('notes', ''),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(assignment)
        session.commit()
        assignment_id = assignment.id
        session.close()
        return jsonify({'success': True, 'assignment_id': assignment_id}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/distance', methods=['POST'])
def calculate_distance():
    data = request.json
    try:
        lat1 = float(data['lat1'])
        lng1 = float(data['lng1'])
        lat2 = float(data['lat2'])
        lng2 = float(data['lng2'])
    except Exception:
        return jsonify({'error': 'Invalid or missing coordinates'}), 400

    # Haversine formula
    R = 6371.0  # Earth radius in kilometers
    dlat = radians(lat2 - lat1)
    dlon = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance_km = R * c
    return jsonify({'distance_km': round(distance_km, 2)})

@app.route('/products/<int:product_id>/forecast', methods=['GET'])
def product_stock_forecast(product_id):
    """
    Returns forecasted depletion days, smoothed daily average, and anomaly indexes for a product.
    Query param: days (default 14)
    """
    days = int(request.args.get('days', 14))
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    product = session.query(Product).filter_by(id=product_id).first()
    if not product:
        session.close()
        return jsonify({'error': 'Product not found'}), 404
    # Get last N days of stock_out transactions for this product
    from datetime import datetime, timedelta
    since = datetime.now() - timedelta(days=days)
    txs = (
        session.query(Transaction)
        .filter(Transaction.product_id == product_id, Transaction.type == 'stock_out', Transaction.date >= since)
        .order_by(Transaction.date.asc())
        .all()
    )
    # Group by day
    daily_outflow = {}
    for tx in txs:
        day = tx.date.date()
        daily_outflow.setdefault(day, 0)
        daily_outflow[day] += tx.quantity
    # Fill missing days with 0
    all_days = [(since + timedelta(days=i)).date() for i in range(days)]
    daily_outflow_list = [daily_outflow.get(day, 0) for day in all_days]
    result = stock_forecast_analysis(product.quantity, daily_outflow_list)
    # Add dates for anomaly indexes
    result['anomaly_dates'] = [str(all_days[i]) for i in result['anomaly_indexes']]
    session.close()
    return jsonify(result)

@app.route('/products/<int:product_id>/purchases', methods=['GET'])
def get_product_purchases(product_id):
    """
    Returns a list of all stock_in transactions for a product, with supplier, quantity, date, and price per unit.
    """
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    txs = (
        session.query(Transaction)
        .filter(Transaction.product_id == product_id, Transaction.type == 'stock_in')
        .order_by(Transaction.date.desc())
        .all()
    )
    purchases = []
    for tx in txs:
        supplier_name = tx.supplier.name if tx.supplier else None
        purchases.append({
            'supplier': supplier_name,
            'quantity': tx.quantity,
            'date': tx.date.strftime('%Y-%m-%d') if tx.date else None,
            'price_per_unit': tx.product.cost if tx.product else None
        })
    session.close()
    return jsonify(purchases)

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')
    if not all([username, email, password, role]):
        return jsonify({'error': 'Missing required fields'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    if session.query(User).filter_by(username=username).first():
        session.close()
        return jsonify({'error': 'Username already exists'}), 409
    if session.query(User).filter_by(email=email).first():
        session.close()
        return jsonify({'error': 'Email already exists'}), 409
    import bcrypt
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, email=email, password_hash=password_hash, role=role)
    session.add(user)
    try:
        session.commit()
        # --- AUTO CREATE CUSTOMER IF ROLE IS CUSTOMER ---
        if str(role) == 'customer':
            # Check if customer with this email already exists
            existing_customer = session.query(Customer).filter_by(email=email).first()
            if not existing_customer:
                customer = Customer(
                    name=username,
                    email=email,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                session.add(customer)
        session.commit()
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': 'Database error: ' + str(e)}), 500
    user_info = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role.value if user.role else None
    }
    session.close()
    return jsonify(user_info), 201

@app.route('/login', methods=['POST'])
@cross_origin(origins=["http://localhost:5173"], supports_credentials=True)
def login():
    print('DEBUG: /login endpoint called')
    data = request.get_json()
    print('DEBUG: Received data:', data)
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        print('DEBUG: Missing username or password')
        return jsonify({'success': False, 'error': 'Missing username or password'}), 400
    print('DEBUG: Calling verify_login')
    result = verify_login(username, password)
    print('DEBUG: verify_login result:', result)
    if result['success']:
        print('DEBUG: Login successful')
        return jsonify({'success': True, 'user_id': result['user_id'], 'role': result['role'], 'username': username})
    else:
        print('DEBUG: Login failed')
        return jsonify({'success': False, 'error': 'Invalid username or password'}), 401

@app.route('/projects/suggest-employees-for-new', methods=['POST'])
def suggest_employees_for_new():
    data = request.get_json()
    requirements = data.get('requirements', [])
    location = data.get('location', '')
    # For now, just use location for location match logic
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    employees = session.query(Employee).filter(Employee.is_available == True).all()
    suggestions = []
    for emp in employees:
        current_workload = 0
        for assignment in emp.assignments:
            if assignment.is_active:
                current_workload += assignment.assigned_hours
        available_hours = emp.max_workload - current_workload
        cost_efficiency = emp.hourly_rate / emp.efficiency_rating
        location_bonus = 1.2 if emp.location == location else 1.0
        overall_score = (emp.efficiency_rating * location_bonus) / emp.hourly_rate
        if available_hours > 0:
            suggestions.append({
                'employee_id': emp.id,
                'name': f"{emp.first_name} {emp.last_name}",
                'email': emp.email,
                'skills': emp.skills,
                'hourly_rate': emp.hourly_rate,
                'efficiency_rating': emp.efficiency_rating,
                'current_workload': current_workload,
                'available_hours': available_hours,
                'location': emp.location,
                'cost_efficiency': cost_efficiency,
                'overall_score': overall_score,
                'recommended_hours': min(available_hours, 20.0),
                'location_match': emp.location == location
            })
    suggestions.sort(key=lambda x: x['overall_score'], reverse=True)
    if not suggestions:
        if not employees:
            reason = 'No employees are marked as available.'
        elif all((emp.max_workload - sum(a.assigned_hours for a in emp.assignments if a.is_active)) <= 0 for emp in employees):
            reason = 'All available employees are fully booked (no available hours).'
        else:
            reason = 'No employees meet the criteria for suggestion.'
        session.close()
        return jsonify({'suggestions': [], 'reason': reason})
    session.close()
    return jsonify({'suggestions': suggestions, 'reason': ''})

@app.route('/requisitions/aggregate', methods=['POST'])
def aggregate_requisitions_api():
    data = request.get_json()
    requisitions = data.get('requisitions', [])
    # Build product lookup
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    product_ids = {r['product_id'] for r in requisitions}
    products = session.query(Product).filter(Product.id.in_(product_ids)).all()
    product_lookup = {str(p.id): {'name': p.name} for p in products}
    # Optionally, build supplier lookup (not implemented, placeholder)
    supplier_lookup = {}
    result = aggregate_requisitions(requisitions, product_lookup, supplier_lookup)
    session.close()
    return jsonify(result)

@app.route('/requisitions/aggregate', methods=['GET'])
def aggregate_pending_requisitions():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    reqs = session.query(Requisition).filter_by(status=RequisitionStatus.pending).all()
    requisitions = [
        {
            'product_id': str(r.product_id),
            'requested_by': r.requested_by,
            'quantity': r.quantity,
            'priority': r.priority,
            'timestamp': r.timestamp.isoformat() if r.timestamp else None
        }
        for r in reqs
    ]
    product_ids = {r['product_id'] for r in requisitions}
    products = session.query(Product).filter(Product.id.in_(product_ids)).all()
    product_lookup = {str(p.id): {'name': p.name} for p in products}
    supplier_lookup = {}
    result = aggregate_requisitions(requisitions, product_lookup, supplier_lookup)
    session.close()
    return jsonify(result)

@app.route('/skills', methods=['GET'])
def get_skills():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    skills = session.query(Skill).all()
    result = [{'id': s.id, 'name': s.name} for s in skills]
    session.close()
    return jsonify(result)

@app.route('/skills', methods=['POST'])
def add_skill():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Skill name required'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    skill = Skill(name=name)
    session.add(skill)
    try:
        session.commit()
        skill_id = skill.id  # Access before session close
        skill_name = skill.name
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400
    session.close()
    return jsonify({'id': skill_id, 'name': skill_name})

@app.route('/skills/<int:skill_id>', methods=['PUT'])
def update_skill(skill_id):
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Skill name required'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    skill = session.query(Skill).filter_by(id=skill_id).first()
    if not skill:
        session.close()
        return jsonify({'error': 'Skill not found'}), 404
    skill.name = name
    try:
        session.commit()
        session.close()
        return jsonify({'id': skill.id, 'name': skill.name})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/skills/<int:skill_id>', methods=['DELETE'])
def delete_skill(skill_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    skill = session.query(Skill).filter_by(id=skill_id).first()
    if not skill:
        session.close()
        return jsonify({'error': 'Skill not found'}), 404
    try:
        session.delete(skill)
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

# --- Finished Products Endpoints ---

@app.route('/finished_products', methods=['POST'])
@cross_origin()
def create_finished_product():
    try:
        data = request.get_json()
        model_name = data.get('model_name')
        total_cost = data.get('total_cost', 0)
        profit_margin_percent = data.get('profit_margin_percent', 20.0)  # Default 20% profit margin
        materials_cost = data.get('materials_cost', 0)
        labor_cost = data.get('labor_cost', 0)
        skills = data.get('skills', [])  # list of skill names or IDs
        materials = data.get('materials', [])  # list of {id, name, quantity}
        
        if not model_name:
            return jsonify({'error': 'Model name required'}), 400
            
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Calculate total cost from materials if not provided
        if not total_cost and materials:
            total_materials_cost = 0
            for m in materials:
                if m.get('id') and m.get('quantity'):
                    product = session.query(Product).filter_by(id=m['id']).first()
                    if product and product.cost:
                        total_materials_cost += m['quantity'] * product.cost
            total_cost = total_materials_cost
        
        # Calculate base price with profit margin
        base_price = total_cost * (1 + profit_margin_percent / 100)
        
        weight = data.get('weight', 1)
        finished_product = FinishedProduct(
            model_name=model_name,
            total_cost=total_cost,
            profit_margin_percent=profit_margin_percent,
            base_price=base_price,
            materials_json=json.dumps([
                {"material_id": m["id"], "name": m.get("name"), "quantity": m["quantity"]}
                for m in materials if m.get("id") and m.get("quantity")
            ]) if materials else None,
            photo_url=data.get('photo_url'),
            weight=weight,
            phase_type=data.get('phase_type'),
            mount_type=data.get('mount_type'),
            compliance_tags=json.dumps(data.get('compliance_tags', [])) if data.get('compliance_tags') else None,
            features=json.dumps(data.get('features', [])) if data.get('features') else None,
            application_tags=json.dumps(data.get('application_tags', [])) if data.get('application_tags') else None,
            voltage_rating=data.get('voltage_rating'),
            min_load_kw=data.get('min_load_kw'),
            max_load_kw=data.get('max_load_kw'),
            estimated_hours=data.get('estimated_hours', 1)
        )
        session.add(finished_product)
        session.flush()  # get finished_product.id
        
        # Attach skills
        skill_names = []
        for skill in skills:
            if isinstance(skill, int):
                skill_obj = session.query(Skill).filter_by(id=skill).first()
            else:
                skill_obj = session.query(Skill).filter_by(name=skill).first()
                if not skill_obj:
                    skill_obj = Skill(name=skill)
                    session.add(skill_obj)
                    session.flush()
            if skill_obj:
                fps = FinishedProductSkill(finished_product_id=finished_product.id, skill_id=skill_obj.id)
                session.add(fps)
                skill_names.append(skill_obj.name)
        
        # Attach materials
        materials_data = []
        for m in materials:
            if not m.get('id') or not m.get('quantity'):
                continue
            fpm = FinishedProductMaterial(finished_product_id=finished_product.id, material_id=m['id'], quantity=m['quantity'])
            session.add(fpm)
            
            # Get material details for response
            product = session.query(Product).filter_by(id=m['id']).first()
            if product:
                materials_data.append({
                    'id': m['id'],
                    'name': product.name,
                    'sku': product.sku,
                    'quantity': m['quantity'],
                    'unit': product.unit,
                    'unit_cost': product.cost,
                    'total_cost': m['quantity'] * (product.cost or 0)
                })
        
        session.commit()
        
        # Fetch attributes before closing session
        fp_id = finished_product.id
        fp_model_name = finished_product.model_name
        fp_total_cost = finished_product.total_cost
        # Calculate labor_cost for response
        labor_cost = fp_total_cost - materials_cost
        if labor_cost < 0:
            labor_cost = 0
        session.close()
        
        return jsonify({
            'id': fp_id, 
            'model_name': fp_model_name, 
            'total_cost': fp_total_cost, 
            'profit_margin_percent': profit_margin_percent,
            'base_price': base_price,
            'skills': skill_names, 
            'materials': materials_data,
            'materials_cost': materials_cost,
            'labor_cost': labor_cost,
            'weight': weight,
            'phase_type': finished_product.phase_type,
            'mount_type': finished_product.mount_type,
            'compliance_tags': json.loads(finished_product.compliance_tags) if finished_product.compliance_tags else [],
            'features': json.loads(finished_product.features) if finished_product.features else [],
            'application_tags': json.loads(finished_product.application_tags) if finished_product.application_tags else [],
            'voltage_rating': finished_product.voltage_rating,
            'min_load_kw': finished_product.min_load_kw,
            'max_load_kw': finished_product.max_load_kw,
            'estimated_hours': finished_product.estimated_hours
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/finished_products/<int:fp_id>', methods=['GET'])
def get_finished_product(fp_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        fp = session.query(FinishedProduct).filter_by(id=fp_id).first()
        if not fp:
            session.close()
            return jsonify({'error': 'Not found'}), 404
        
        # Get skills
        skills = []
        for fps in fp.skills:
            skill = session.query(Skill).filter_by(id=fps.skill_id).first()
            if skill:
                skills.append(skill.name)
        
        # Get materials with cost breakdown
        from sqlalchemy import text
        materials_rows = session.execute(text('''
            SELECT p.name, p.sku, fpm.quantity, p.unit, p.cost, (fpm.quantity * p.cost) as total_cost
            FROM finished_product_materials fpm
            JOIN products p ON fpm.material_id = p.id
            WHERE fpm.finished_product_id = :fp_id
        '''), {'fp_id': fp_id}).fetchall()
        
        materials = [
            {
                'name': row[0],
                'sku': row[1],
                'quantity': row[2],
                'unit': row[3],
                'unit_cost': row[4],
                'total_cost': row[5]
            } for row in materials_rows
        ]
        
        total_materials_cost = sum(m['total_cost'] for m in materials)
        labor_cost = fp.total_cost - total_materials_cost
        
        result = {
            'id': fp.id,
            'model_name': fp.model_name,
            'total_cost': fp.total_cost,
            'profit_margin_percent': fp.profit_margin_percent,
            'base_price': fp.base_price,
            'materials_cost': total_materials_cost,
            'labor_cost': labor_cost,
            'skills': skills,
            'materials': materials,
            'materials_json': fp.materials_json,
            'photo_url': fp.photo_url,
            'weight': fp.weight,
            'phase_type': fp.phase_type,
            'mount_type': fp.mount_type,
            'compliance_tags': json.loads(fp.compliance_tags) if fp.compliance_tags else [],
            'features': json.loads(fp.features) if fp.features else [],
            'application_tags': json.loads(fp.application_tags) if fp.application_tags else [],
            'voltage_rating': fp.voltage_rating,
            'min_load_kw': fp.min_load_kw,
            'max_load_kw': fp.max_load_kw,
            'estimated_hours': fp.estimated_hours
        }
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/finished_products', methods=['GET'])
def get_finished_products():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        finished_products = session.query(FinishedProduct).all()
        result = []
        
        for fp in finished_products:
            # Get skills count using direct query
            skills_count = session.query(FinishedProductSkill).filter_by(finished_product_id=fp.id).count()
            
            # Get actual skills data
            skills = []
            skills_query = session.query(FinishedProductSkill).filter_by(finished_product_id=fp.id).all()
            for fps in skills_query:
                skill = session.query(Skill).filter_by(id=fps.skill_id).first()
                if skill:
                    skills.append(skill.name)
            
            # Get materials count and total materials cost
            from sqlalchemy import text
            materials_info = session.execute(text('''
                SELECT COUNT(*) as count, SUM(fpm.quantity * p.cost) as total_cost
                FROM finished_product_materials fpm
                JOIN products p ON fpm.material_id = p.id
                WHERE fpm.finished_product_id = :fp_id
            '''), {'fp_id': fp.id}).fetchone()
            
            materials_count = materials_info[0] if materials_info[0] else 0
            materials_cost = materials_info[1] if materials_info[1] else 0
            labor_cost = fp.total_cost - materials_cost if fp.total_cost else 0
            
            result.append({
                'id': fp.id,
                'model_name': fp.model_name,
                'total_cost': fp.total_cost,
                'profit_margin_percent': fp.profit_margin_percent,
                'base_price': fp.base_price,
                'materials_cost': materials_cost,
                'labor_cost': labor_cost,
                'skills_count': skills_count,
                'skills': skills,  # Add actual skills data
                'materials_count': materials_count,
                'materials_json': fp.materials_json,
                'photo_url': fp.photo_url,
                'weight': fp.weight,
                'phase_type': fp.phase_type,
                'mount_type': fp.mount_type,
                'compliance_tags': json.loads(fp.compliance_tags) if fp.compliance_tags else [],
                'features': json.loads(fp.features) if fp.features else [],
                'application_tags': json.loads(fp.application_tags) if fp.application_tags else [],
                'voltage_rating': fp.voltage_rating,
                'min_load_kw': fp.min_load_kw,
                'max_load_kw': fp.max_load_kw,
                'estimated_hours': fp.estimated_hours
            })
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        print(f"Error in get_finished_products: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- Customer Request Workflow Endpoints ---
from sqlalchemy.orm import joinedload

@app.route('/customer_requests', methods=['POST'])
def create_customer_request():
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        req = CustomerRequest(
            customer_id=data['customer_id'],
            product_id=data['product_id'],
            quantity=data['quantity'],
            expected_delivery=datetime.fromisoformat(data['expected_delivery']) if data.get('expected_delivery') else None,
            delivery_address=data.get('delivery_address'),
            status=CustomerRequestStatus.submitted.value,
            notes=data.get('notes'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(req)
        session.commit()
        req_id = req.id
        session.close()
        return jsonify({'success': True, 'request_id': req_id}), 201
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/customer_requests', methods=['GET'])
@cross_origin()
def list_customer_requests():
    status = request.args.get('status')
    customer_id = request.args.get('customer_id')
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    query = session.query(CustomerRequest).options(joinedload(CustomerRequest.product), joinedload(CustomerRequest.customer), joinedload(CustomerRequest.manager))
    if status:
        query = query.filter(CustomerRequest.status == CustomerRequestStatus(status))
    if customer_id:
        query = query.filter(CustomerRequest.customer_id == int(customer_id))
    requests = query.order_by(CustomerRequest.created_at.desc()).all()
    result = []
    for r in requests:
        result.append({
            'id': r.id,
            'customer_id': r.customer_id,
            'customer_name': r.customer.username if r.customer else None,
            'product_id': r.product_id,
            'product_name': r.product.name if r.product else None,
            'quantity': r.quantity,
            'expected_delivery': r.expected_delivery.isoformat() if r.expected_delivery else None,
            'delivery_address': r.delivery_address,
            'status': r.status,
            'manager_id': r.manager_id,
            'manager_name': r.manager.username if r.manager else None,
            'quoted_price': r.quoted_price,
            'customer_response': r.customer_response,
            'notes': r.notes,
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'updated_at': r.updated_at.isoformat() if r.updated_at else None
        })
    session.close()
    return jsonify(result)

@app.route('/customer_requests/<int:req_id>', methods=['GET'])
@cross_origin()
def get_customer_request(req_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    r = session.query(CustomerRequest).options(joinedload(CustomerRequest.product), joinedload(CustomerRequest.customer), joinedload(CustomerRequest.manager)).filter_by(id=req_id).first()
    if not r:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    result = {
        'id': r.id,
        'customer_id': r.customer_id,
        'customer_name': r.customer.username if r.customer else None,
        'product_id': r.product_id,
        'product_name': r.product.name if r.product else None,
        'quantity': r.quantity,
        'expected_delivery': r.expected_delivery.isoformat() if r.expected_delivery else None,
        'delivery_address': r.delivery_address,
        'status': r.status,
        'manager_id': r.manager_id,
        'manager_name': r.manager.username if r.manager else None,
        'quoted_price': r.quoted_price,
        'customer_response': r.customer_response,
        'notes': r.notes,
        'created_at': r.created_at.isoformat() if r.created_at else None,
        'updated_at': r.updated_at.isoformat() if r.updated_at else None
    }
    session.close()
    return jsonify(result)

@app.route('/customer_requests/<int:req_id>/manager_review', methods=['POST'])
@cross_origin()
def manager_review_request(req_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        req.status = CustomerRequestStatus.manager_review.value
        req.manager_id = data['manager_id']
        req.notes = data.get('notes', req.notes)
        req.updated_at = datetime.now()
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/customer_requests/<int:req_id>/quote', methods=['POST'])
@cross_origin()
def manager_quote_request(req_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        req.status = CustomerRequestStatus.quoted.value
        req.quoted_price = data['quoted_price']
        req.notes = data.get('notes', req.notes)
        req.updated_at = datetime.now()
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/customer_requests/<int:req_id>/customer_response', methods=['POST'])
def customer_respond_request(req_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        response_type = data.get('response')
        revision_notes = data.get('revision_notes', '')
        
        if response_type == 'accepted':
            req.status = CustomerRequestStatus.customer_accepted.value
            req.customer_response = 'accepted'
            req.notes = f"Customer accepted quote on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}. {revision_notes}"
        elif response_type == 'declined':
            req.status = CustomerRequestStatus.customer_declined.value
            req.customer_response = 'declined'
            req.notes = f"Customer declined quote on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}. Reason: {revision_notes}"
        elif response_type == 'revise':
            req.status = CustomerRequestStatus.submitted.value
            req.customer_response = 'revision_requested'
            req.notes = f"Customer requested revision on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}. Revision notes: {revision_notes}"
            # Reset quoted price to allow manager to provide new quote
            req.quoted_price = None
        
        req.updated_at = datetime.now()
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': f'Request {response_type} successfully'})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

# --- Transporter Step ---

@app.route('/customer_requests/<int:req_id>/assign_transporter', methods=['POST'])
def assign_transporter(req_id):
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        transporter_id = data['transporter_id']
        # Add transporter_id to the request (if not present in model, add to model/migration)
        req.status = CustomerRequestStatus.in_transit.value
        req.notes = data.get('notes', req.notes)
        req.updated_at = datetime.now()
        # If transporter_id field exists:
        if hasattr(req, 'transporter_id'):
            req.transporter_id = transporter_id
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/customer_requests/<int:req_id>/mark_completed', methods=['POST'])
def mark_request_completed(req_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        req.status = CustomerRequestStatus.completed
        req.updated_at = datetime.now()
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/project_orders', methods=['GET'])
def get_project_orders():
    supplier_id = request.args.get('supplier_id')
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    query = session.query(ProjectOrder)
    if supplier_id:
        query = query.filter(ProjectOrder.supplier_id == int(supplier_id))
    orders = query.all()
    result = []
    for o in orders:
        result.append({
            'id': o.id,
            'project_id': o.project_id,
            'order_number': o.order_number,
            'supplier_id': o.supplier_id,
            'total_amount': o.total_amount,
            'status': o.status.value if o.status else None,
            'order_date': o.order_date.isoformat() if o.order_date else None,
            'expected_delivery': o.expected_delivery.isoformat() if o.expected_delivery else None,
            'actual_delivery': o.actual_delivery.isoformat() if o.actual_delivery else None,
            'notes': o.notes,
            'created_at': o.created_at.isoformat() if o.created_at else None,
            'updated_at': o.updated_at.isoformat() if o.updated_at else None
        })
    session.close()
    return jsonify(result)

@app.route('/users', methods=['GET'])
def get_users():
    username = request.args.get('username')
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    if username:
        user = session.query(User).filter_by(username=username).first()
        if not user:
            session.close()
            return jsonify({'error': 'User not found'}), 404
        user_info = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role.value if user.role else None
        }
        session.close()
        return jsonify(user_info)
    # No username: return all users
    users = session.query(User).all()
    result = []
    for u in users:
        result.append({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'role': u.role.value if u.role else None
        })
    session.close()
    return jsonify(result)

@app.route('/audit-logs', methods=['GET'])
def get_audit_logs():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    logs = session.query(AuditLog).all()
    result = []
    for log in logs:
        result.append({
            'id': log.id,
            'product_id': log.product_id,
            'user_id': log.user_id,
            'field_changed': log.field_changed,
            'old_value': log.old_value,
            'new_value': log.new_value,
            'timestamp': log.timestamp.isoformat() if log.timestamp else None
        })
    session.close()
    return jsonify(result)

@app.route('/products/upload-photo', methods=['POST'])
def upload_product_photo():
    if 'photo' not in request.files:
        return jsonify({'error': 'No photo uploaded'}), 400
    file = request.files['photo']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Validate file type
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
        return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WEBP'}), 400
    
    # Validate file size (5MB limit)
    file.seek(0, 2)  # Seek to end
    file_size = file.tell()
    file.seek(0)  # Reset to beginning
    if file_size > 5 * 1024 * 1024:  # 5MB
        return jsonify({'error': 'File too large. Maximum size: 5MB'}), 400
    
    filename = secure_filename(file.filename)
    # Add timestamp to prevent filename conflicts
    import time
    timestamp = int(time.time())
    name, ext = os.path.splitext(filename)
    filename = f"{name}_{timestamp}{ext}"
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Serve from /static/product_photos/<filename>
    url = f'/static/product_photos/{filename}'
    return jsonify({'url': url})

# New endpoint to get master product catalog (products without supplier_id)
@app.route('/master-products', methods=['GET'])
@cross_origin()
def get_master_products():
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        # Only include materials: category is Tool, Component, or Raw Material (case-insensitive)
        allowed_categories = ['tool', 'component', 'raw material']
        products = session.query(Product).filter(
            Product.supplier_id.is_(None),
            Product.category.isnot(None)
        ).all()
        filtered_products = [
            p for p in products
            if p.category and p.category.strip().lower() in allowed_categories
        ]
        result = [{
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'category': p.category,
            'unit': p.unit,
            'photo_url': p.photo_url
        } for p in filtered_products]
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# New endpoint to get supplier's products (from SupplierProduct table)
@app.route('/supplier-products/<int:supplier_id>', methods=['GET'])
@cross_origin()
def get_supplier_products(supplier_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        # Get products from SupplierProduct table (custom showcase)
        supplier_products = session.query(SupplierProduct).filter(
            SupplierProduct.supplier_id == supplier_id,
            SupplierProduct.is_active == True
        ).all()
        result = []
        seen_product_ids = set()
        for sp in supplier_products:
            product = session.query(Product).filter(Product.id == sp.product_id).first()
            if product:
                result.append({
                    'id': sp.id,
                    'product_id': sp.product_id,
                    'product_name': product.name,
                    'product_sku': product.sku,
                    'product_category': product.category,
                    'product_unit': product.unit,
                    'product_photo_url': product.photo_url,
                    'current_stock': sp.current_stock,
                    'unit_price': sp.unit_price,
                    'is_active': sp.is_active
                })
                seen_product_ids.add(sp.product_id)
        # Also get products directly from products table for this supplier
        direct_products = session.query(Product).filter(Product.supplier_id == supplier_id).all()
        for product in direct_products:
            if product.id in seen_product_ids:
                continue  # skip if already included from SupplierProduct
            result.append({
                'id': product.id,
                'product_id': product.id,
                'product_name': product.name,
                'product_sku': product.sku,
                'product_category': product.category,
                'product_unit': product.unit,
                'product_photo_url': product.photo_url,
                'current_stock': product.quantity,
                'unit_price': product.cost,
                'is_active': True
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# New endpoint to add product to supplier's showcase
@app.route('/supplier-products', methods=['POST'])
@cross_origin()
def add_supplier_product():
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        product_id = data.get('product_id')
        current_stock = data.get('current_stock', 0)
        unit_price = data.get('unit_price', 0)
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Check if product exists in master catalog
        product = session.query(Product).filter(
            Product.id == product_id,
            Product.supplier_id.is_(None)
        ).first()
        
        if not product:
            session.close()
            return jsonify({'error': 'Product not found in master catalog'}), 404
        
        # Check if supplier already has this product
        existing = session.query(SupplierProduct).filter(
            SupplierProduct.supplier_id == supplier_id,
            SupplierProduct.product_id == product_id
        ).first()
        
        if existing:
            session.close()
            return jsonify({'error': 'Product already in supplier showcase'}), 400
        
        # Create new supplier product
        supplier_product = SupplierProduct(
            supplier_id=supplier_id,
            product_id=product_id,
            current_stock=current_stock,
            unit_price=unit_price,
            is_active=data.get('is_active', True),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        session.add(supplier_product)
        session.commit()
        
        result_id = supplier_product.id
        session.close()
        return jsonify({'success': True, 'id': result_id})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# New endpoint to update supplier product stock
@app.route('/supplier-products/<int:supplier_product_id>', methods=['PUT'])
@cross_origin()
def update_supplier_product(supplier_product_id):
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        supplier_product = session.query(SupplierProduct).filter(
            SupplierProduct.id == supplier_product_id
        ).first()
        
        if not supplier_product:
            session.close()
            return jsonify({'error': 'Supplier product not found'}), 404
        
        # Update fields
        if 'current_stock' in data:
            supplier_product.current_stock = data['current_stock']
        if 'unit_price' in data:
            supplier_product.unit_price = data['unit_price']
        
        supplier_product.updated_at = datetime.now()
        session.commit()
        
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# New endpoint to remove product from supplier showcase
@app.route('/supplier-products/<int:supplier_product_id>', methods=['DELETE'])
@cross_origin()
def remove_supplier_product(supplier_product_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        supplier_product = session.query(SupplierProduct).filter(
            SupplierProduct.id == supplier_product_id
        ).first()
        
        if not supplier_product:
            session.close()
            return jsonify({'error': 'Supplier product not found'}), 404
        
        # Soft delete by setting is_active to False
        supplier_product.is_active = False
        supplier_product.updated_at = datetime.now()
        session.commit()
        
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# SUPPLIER REQUESTS AND INVOICES API ENDPOINTS
# ============================================================================

# Get all supplier requests (for admin/project managers)
@app.route('/supplier-requests', methods=['GET'])
@cross_origin()
def get_supplier_requests():
    import logging
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        requests = session.query(SupplierRequest).order_by(SupplierRequest.created_at.desc()).all()
        result = []
        for req in requests:
            try:
                # Get suppliers with their individual statuses and fulfillment statuses
                supplier_statuses = session.execute(
                    text("SELECT s.id, s.name, s.email, srs.supplier_status, srs.fulfillment_status, srs.packing_timestamp, srs.dispatched_timestamp, srs.delivered_timestamp FROM suppliers s " +
                    "JOIN supplier_request_suppliers srs ON s.id = srs.supplier_id " +
                    "WHERE srs.request_id = :request_id"),
                    {'request_id': req.id}
                ).fetchall()
                
                supplier_list = [
                    {
                        'id': row.id, 
                        'name': row.name, 
                        'email': row.email,
                        'status': row.supplier_status or 'pending',
                        'fulfillment_status': row.fulfillment_status or 'accepted',
                        'packing_timestamp': row.packing_timestamp.isoformat() if row.packing_timestamp else None,
                        'dispatched_timestamp': row.dispatched_timestamp.isoformat() if row.dispatched_timestamp else None,
                        'delivered_timestamp': row.delivered_timestamp.isoformat() if row.delivered_timestamp else None
                    }
                    for row in supplier_statuses
                ]
            except Exception as e:
                supplier_list = []
                logging.error(f"Supplier list lookup failed: {e}")
            try:
                requester = session.query(User).filter(User.id == req.requester_id).first()
            except Exception as e:
                requester = None
                logging.error(f"Requester lookup failed: {e}")
            try:
                project = session.query(Project).filter(Project.id == req.project_id).first() if req.project_id else None
            except Exception as e:
                project = None
                logging.error(f"Project lookup failed: {e}")
            # Always return status as string
            status_val = req.status
            if hasattr(status_val, 'value'):
                status_val = status_val.value
            elif status_val is None:
                status_val = ''
            result.append({
                'id': req.id,
                'request_number': req.request_number,
                'title': req.title,
                'description': req.description,
                'suppliers': supplier_list,
                'requester_id': req.requester_id,
                'requester_name': requester.username if requester else None,
                'project_id': req.project_id,
                'project_name': project.name if project else None,
                'priority': req.priority,
                'status': status_val,
                'expected_delivery_date': req.expected_delivery_date.isoformat() if req.expected_delivery_date else None,
                'delivery_address': req.delivery_address,
                'total_amount': req.total_amount,
                'notes': req.notes,
                'created_at': req.created_at.isoformat() if req.created_at else None,
                'updated_at': req.updated_at.isoformat() if req.updated_at else None
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        import traceback
        logging.error(f"Error in get_supplier_requests: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

# Get supplier requests for a specific supplier
@app.route('/supplier-requests/supplier/<int:supplier_id>', methods=['GET'])
@cross_origin()
def get_supplier_requests_by_supplier(supplier_id):
    import logging, traceback
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        # Use many-to-many association to find requests for this supplier
        requests = session.query(SupplierRequest).join(SupplierRequest.suppliers).filter(Supplier.id == supplier_id).order_by(SupplierRequest.created_at.desc()).all()
        result = []
        for req in requests:
            requester = session.query(User).filter(User.id == req.requester_id).first()
            project = session.query(Project).filter(Project.id == req.project_id).first() if req.project_id else None
            
            # Get this supplier's status and fulfillment info for this request
            supplier_info = session.execute(
                text("SELECT supplier_status, fulfillment_status, packing_timestamp, dispatched_timestamp, delivered_timestamp FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': req.id, 'supplier_id': supplier_id}
            ).fetchone()
            
            result.append({
                'id': req.id,
                'request_number': req.request_number,
                'title': req.title,
                'description': req.description,
                'requester_id': req.requester_id,
                'requester_name': requester.username if requester else None,
                'project_id': req.project_id,
                'project_name': project.name if project else None,
                'priority': req.priority,
                'status': supplier_info.supplier_status if supplier_info else 'pending',
                'fulfillment_status': supplier_info.fulfillment_status if supplier_info else None,
                'packing_timestamp': supplier_info.packing_timestamp.isoformat() if supplier_info and supplier_info.packing_timestamp else None,
                'dispatched_timestamp': supplier_info.dispatched_timestamp.isoformat() if supplier_info and supplier_info.dispatched_timestamp else None,
                'delivered_timestamp': supplier_info.delivered_timestamp.isoformat() if supplier_info and supplier_info.delivered_timestamp else None,
                'expected_delivery_date': req.expected_delivery_date.isoformat() if req.expected_delivery_date else None,
                'delivery_address': req.delivery_address,
                'total_amount': req.total_amount,
                'notes': req.notes,
                'created_at': req.created_at.isoformat() if req.created_at else None,
                'updated_at': req.updated_at.isoformat() if req.updated_at else None
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        logging.error(f"Error in get_supplier_requests_by_supplier: {e}\n{traceback.format_exc()}")
        session.close()
        return jsonify({'error': str(e)}), 500

# Create new supplier request
@app.route('/supplier-requests', methods=['POST'])
@cross_origin()
def create_supplier_request():
    try:
        data = request.json
        # Validate required fields
        missing = []
        if not data.get('title'): missing.append('title')
        if not data.get('requester_id'): missing.append('requester_id')
        supplier_ids = data.get('supplier_ids')
        items = data.get('items')
        if not supplier_ids or not isinstance(supplier_ids, list) or len(supplier_ids) == 0:
            missing.append('supplier_ids (must be a non-empty array)')
        if not items or not isinstance(items, list) or len(items) == 0:
            missing.append('items (must be a non-empty array)')
        else:
            for idx, item in enumerate(items):
                if not item.get('product_id'): missing.append(f'items[{idx}].product_id')
                if not item.get('quantity'): missing.append(f'items[{idx}].quantity')
        # Length validation
        if data.get('title') and len(data['title']) > 500:
            return jsonify({'error': 'title must be at most 500 characters'}), 400
        if data.get('priority') and len(data['priority']) > 50:
            return jsonify({'error': 'priority must be at most 50 characters'}), 400
        if data.get('status') and len(data['status']) > 50:
            return jsonify({'error': 'status must be at most 50 characters'}), 400
        if missing:
            return jsonify({'error': f'Missing or invalid fields: {", ".join(missing)}'}), 400
        # Validate expected_delivery_date
        expected_delivery_date = None
        if data.get('expected_delivery_date'):
            try:
                expected_delivery_date = datetime.fromisoformat(data['expected_delivery_date'])
            except Exception:
                return jsonify({'error': 'expected_delivery_date must be a valid ISO date string'}), 400
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        # Generate request number
        import uuid
        request_number = f"REQ-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        # Create request
        supplier_request = SupplierRequest(
            request_number=request_number,
            title=data.get('title'),
            description=data.get('description'),
            requester_id=data.get('requester_id'),
            project_id=data.get('project_id'),
            priority=data.get('priority', 'medium'),
            status=data.get('status', 'draft'),
            expected_delivery_date=expected_delivery_date,
            delivery_address=data.get('delivery_address'),
            notes=data.get('notes'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        # Add suppliers to association table
        suppliers = session.query(Supplier).filter(Supplier.id.in_(supplier_ids)).all()
        supplier_request.suppliers = suppliers
        session.add(supplier_request)
        session.flush()  # Get the ID
        # Add items
        total_amount = 0
        for item_data in items:
            item = SupplierRequestItem(
                request_id=supplier_request.id,
                product_id=item_data['product_id'],
                quantity=item_data['quantity'],
                unit_price=item_data.get('unit_price', 0),
                total_price=item_data['quantity'] * item_data.get('unit_price', 0),
                specifications=item_data.get('specifications'),
                notes=item_data.get('notes')
            )
            total_amount += item.total_price
            session.add(item)
        # Update total amount
        supplier_request.total_amount = total_amount
        session.commit()
        result_id = supplier_request.id
        session.close()
        return jsonify({
            'success': True,
            'id': supplier_request.id,
            'request_number': request_number
        })
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# Get specific supplier request with items
@app.route('/supplier-requests/<int:request_id>', methods=['GET'])
@cross_origin()
def get_supplier_request(request_id):
    import logging, traceback
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        requester = session.query(User).filter(User.id == request.requester_id).first()
        project = session.query(Project).filter(Project.id == request.project_id).first() if request.project_id else None
        
        # Get suppliers with their individual statuses and fulfillment statuses
        supplier_statuses = session.execute(
            text("SELECT s.id, s.name, s.email, srs.supplier_status, srs.fulfillment_status FROM suppliers s " +
                "JOIN supplier_request_suppliers srs ON s.id = srs.supplier_id " +
                "WHERE srs.request_id = :request_id"),
            {'request_id': request_id}
        ).fetchall()
        
        supplier_list = [
            {
                'id': row.id, 
                'name': row.name, 
                'email': row.email,
                'status': row.supplier_status or 'pending',
                'fulfillment_status': row.fulfillment_status or 'accepted'
            }
            for row in supplier_statuses
        ]
        
        # Get items
        items = session.query(SupplierRequestItem).filter(SupplierRequestItem.request_id == request_id).all()
        items_data = []
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).first()
            items_data.append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else None,
                'product_sku': product.sku if product else None,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total_price': item.total_price,
                'specifications': item.specifications,
                'notes': item.notes
            })
        result = {
            'id': request.id,
            'request_number': request.request_number,
            'title': request.title,
            'description': request.description,
            'suppliers': supplier_list,
            'requester_id': request.requester_id,
            'requester_name': requester.username if requester else None,
            'project_id': request.project_id,
            'project_name': project.name if project else None,
            'priority': request.priority,
            'status': request.status if not hasattr(request.status, 'value') else request.status.value,
            'expected_delivery_date': request.expected_delivery_date.isoformat() if request.expected_delivery_date else None,
            'delivery_address': request.delivery_address,
            'total_amount': request.total_amount,
            'notes': request.notes,
            'created_at': request.created_at.isoformat() if request.created_at else None,
            'updated_at': request.updated_at.isoformat() if request.updated_at else None,
            'items': items_data
        }
        session.close()
        return jsonify(result)
    except Exception as e:
        logging.error(f"Error in get_supplier_request: {e}\n{traceback.format_exc()}")
        session.close()
        return jsonify({'error': str(e)}), 500

# Update supplier request status
@app.route('/supplier-requests/<int:request_id>/status', methods=['PUT'])
@cross_origin()
def update_supplier_request_status(request_id):
    session = None
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        new_status = data.get('status')
        if new_status:
            supplier_request.status = new_status
            supplier_request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Accept supplier request (Admin only - should be used to accept a supplier's quote)
@app.route('/supplier-requests/<int:request_id>/accept', methods=['POST'])
@cross_origin()
def accept_supplier_request(request_id):
    """Admin endpoint to accept a supplier's quote for a request"""
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        
        if not supplier_id:
            return jsonify({'error': 'Missing supplier_id'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Find the supplier's quote for this request
        quote = session.query(SupplierRequestQuote).filter(
            SupplierRequestQuote.request_id == request_id,
            SupplierRequestQuote.supplier_id == supplier_id
        ).first()
        
        if not quote:
            session.close()
            return jsonify({'error': 'Quote not found for this supplier and request'}), 404
        
        # Update the quote status to 'agreed'
        quote.status = 'agreed'
        quote.updated_at = datetime.now()
        
        # Reject all other quotes for this request
        other_quotes = session.query(SupplierRequestQuote).filter(
            SupplierRequestQuote.request_id == request_id,
            SupplierRequestQuote.id != quote.id,
            SupplierRequestQuote.status.notin_(['rejected', 'agreed'])
        ).all()
        
        for other_quote in other_quotes:
            other_quote.status = 'rejected'
            other_quote.updated_at = datetime.now()
        
        # Update the request status
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if supplier_request:
            supplier_request.status = 'confirmed'
            supplier_request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'message': f'Quote from supplier {supplier_id} accepted for request {request_id}'
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Supplier direct accept request (without quote)
@app.route('/supplier-requests/<int:request_id>/supplier-accept', methods=['POST'])
@cross_origin()
def supplier_accept_request_direct(request_id):
    """Supplier endpoint to directly accept a material request without submitting a quote"""
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        
        if not supplier_id:
            return jsonify({'error': 'Missing supplier_id'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the supplier request
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Check if this supplier is assigned to this request (using many-to-many relationship)
        supplier = session.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier or supplier not in supplier_request.suppliers:
            session.close()
            return jsonify({'error': 'You are not authorized to accept this request'}), 403
        
        # Check if any supplier has already accepted this request
        existing_accepted = session.execute(
            text("SELECT supplier_id FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_status = 'accepted'"),
            {'request_id': request_id}
        ).fetchone()
        
        if existing_accepted:
            session.close()
            return jsonify({'error': 'This request has already been accepted by another supplier'}), 400
        
        # Check if this supplier has already responded (accepted or rejected)
        current_status = session.execute(
            text("SELECT supplier_status FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        ).fetchone()
        
        if current_status and current_status[0] in ['accepted', 'rejected']:
            session.close()
            return jsonify({'error': f'You have already {current_status[0]} this request'}), 400
        
        # Update this supplier's status to accepted
        # supplier_request_association = session.execute(
        #     text("UPDATE supplier_request_suppliers SET supplier_status = 'accepted' WHERE request_id = :request_id AND supplier_id = :supplier_id"),
        #     {'request_id': request_id, 'supplier_id': supplier_id}
        # )
        # Calculate shipping, tax, and grand total for this supplier
        import json
        delivery_address = supplier_request.delivery_address or ''
        subtotal = supplier_request.total_amount or 0
        product_category = 'machinery'
        shipping_info = calculate_supplier_shipping_cost(
            supplier_id,
            delivery_address,
            subtotal,
            product_category
        )
        shipping_cost = shipping_info['shipping_cost']
        tax_amount = shipping_info['tax_breakdown']['total_tax']
        grand_total = shipping_info['grand_total']
        distance_km = shipping_info['distance_km']
        tax_breakdown_json = json.dumps(shipping_info['tax_breakdown'])
        session.execute(
            text("""
                UPDATE supplier_request_suppliers
                SET supplier_status = 'accepted',
                    shipping_cost = :shipping_cost,
                    tax_amount = :tax_amount,
                    grand_total = :grand_total,
                    distance_km = :distance_km,
                    tax_breakdown = :tax_breakdown
                WHERE request_id = :request_id AND supplier_id = :supplier_id
            """),
            {
                'request_id': request_id,
                'supplier_id': supplier_id,
                'shipping_cost': shipping_cost,
                'tax_amount': tax_amount,
                'grand_total': grand_total,
                'distance_km': distance_km,
                'tax_breakdown': tax_breakdown_json
            }
        )
        supplier_request.updated_at = datetime.now()
        session.commit()
        session.close()
        return jsonify({
            'success': True,
            'message': f'Request {request_id} accepted successfully',
            'shipping_cost': shipping_cost,
            'tax_amount': tax_amount,
            'grand_total': grand_total,
            'distance_km': distance_km,
            'tax_breakdown': shipping_info['tax_breakdown']
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Supplier direct reject request (without quote)
@app.route('/supplier-requests/<int:request_id>/supplier-reject', methods=['POST'])
@cross_origin()
def supplier_reject_request_direct(request_id):
    """Supplier endpoint to directly reject a material request without submitting a quote"""
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        
        if not supplier_id:
            return jsonify({'error': 'Missing supplier_id'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the supplier request
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Check if this supplier is assigned to this request (using many-to-many relationship)
        supplier = session.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier or supplier not in supplier_request.suppliers:
            session.close()
            return jsonify({'error': 'You are not authorized to reject this request'}), 403
        
        # Check if any supplier has already accepted this request
        existing_accepted = session.execute(
            text("SELECT supplier_id FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_status = 'accepted'"),
            {'request_id': request_id}
        ).fetchone()
        
        if existing_accepted:
            session.close()
            return jsonify({'error': 'This request has already been accepted by another supplier'}), 400
        
        # Check if this supplier has already responded (accepted or rejected)
        current_status = session.execute(
            text("SELECT supplier_status FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        ).fetchone()
        
        if current_status and current_status[0] in ['accepted', 'rejected']:
            session.close()
            return jsonify({'error': f'You have already {current_status[0]} this request'}), 400
        
        # Update this supplier's status to rejected
        supplier_request_association = session.execute(
            text("UPDATE supplier_request_suppliers SET supplier_status = 'rejected' WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        )
        
        # Update the main request status to 'supplier_responded' if any supplier has responded
        supplier_request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'message': f'Request {request_id} rejected successfully'
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Supplier send revised offer
@app.route('/supplier-requests/<int:request_id>/supplier-revised-offer', methods=['POST'])
@cross_origin()
def supplier_send_revised_offer(request_id):
    """Supplier endpoint to send a revised offer to admin for negotiation"""
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        total_amount = data.get('total_amount')
        notes = data.get('notes', '')
        items = data.get('items', [])
        
        if not supplier_id:
            return jsonify({'error': 'Missing supplier_id'}), 400
        
        if not total_amount:
            return jsonify({'error': 'Missing total_amount'}), 400
        
        if not items:
            return jsonify({'error': 'Missing items'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the supplier request
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Check if this supplier is assigned to this request (using many-to-many relationship)
        supplier = session.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier or supplier not in supplier_request.suppliers:
            session.close()
            return jsonify({'error': 'You are not authorized to send offers for this request'}), 403
        
        # Check if any supplier has already accepted this request
        existing_accepted = session.execute(
            text("SELECT supplier_id FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_status = 'accepted'"),
            {'request_id': request_id}
        ).fetchone()
        
        if existing_accepted:
            session.close()
            return jsonify({'error': 'This request has already been accepted by another supplier'}), 400
        
        # Check if this supplier has already responded (accepted or rejected)
        current_status = session.execute(
            text("SELECT supplier_status FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        ).fetchone()
        
        if current_status and current_status[0] in ['accepted', 'rejected']:
            session.close()
            return jsonify({'error': f'You have already {current_status[0]} this request'}), 400
        
        # Create the negotiation record
        negotiation = SupplierNegotiation(
            request_id=request_id,
            supplier_id=supplier_id,
            offer_type='revised_offer',
            total_amount=total_amount,
            notes=notes
        )
        session.add(negotiation)
        session.flush()  # Get the ID
        
        # Add negotiation items
        for item in items:
            negotiation_item = SupplierNegotiationItem(
                negotiation_id=negotiation.id,
                product_id=item.get('product_id'),
                quantity=item.get('quantity'),
                unit_price=item.get('unit_price'),
                total_price=item.get('total_price'),
                specifications=item.get('specifications', ''),
                notes=item.get('notes', '')
            )
            session.add(negotiation_item)
        
        # Update supplier status to revised_offer
        session.execute(
            text("UPDATE supplier_request_suppliers SET supplier_status = 'revised_offer' WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        )
        
        # Update the main request status
        supplier_request.updated_at = datetime.now()
        
        # Get the negotiation ID before closing session
        negotiation_id = negotiation.id
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'message': f'Revised offer sent successfully for request {request_id}',
            'negotiation_id': negotiation_id
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Admin respond to supplier offer (accept/reject/counter)
@app.route('/supplier-requests/<int:request_id>/admin-respond-offer', methods=['POST'])
@cross_origin()
def admin_respond_to_offer(request_id):
    """Admin endpoint to respond to a supplier's revised offer"""
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        action = data.get('action')  # 'accept', 'reject', 'counter'
        counter_offer = data.get('counter_offer', {})  # Only needed for counter action
        notes = data.get('notes', '')
        
        if not supplier_id:
            return jsonify({'error': 'Missing supplier_id'}), 400
        
        if action not in ['accept', 'reject', 'counter']:
            return jsonify({'error': 'Invalid action. Must be accept, reject, or counter'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the supplier request
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Check if this supplier has a revised offer
        current_status = session.execute(
            text("SELECT supplier_status FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        ).fetchone()
        
        if not current_status or current_status[0] != 'revised_offer':
            session.close()
            return jsonify({'error': 'No revised offer found for this supplier'}), 400
        
        # Get the latest negotiation for this supplier
        negotiation = session.query(SupplierNegotiation).filter(
            SupplierNegotiation.request_id == request_id,
            SupplierNegotiation.supplier_id == supplier_id,
            SupplierNegotiation.offer_type == 'revised_offer'
        ).order_by(SupplierNegotiation.created_at.desc()).first()
        
        if not negotiation:
            session.close()
            return jsonify({'error': 'No negotiation record found'}), 400
        
        if action == 'accept':
            # Accept the offer and update supplier status
            negotiation.status = 'accepted'
            session.execute(
                text("UPDATE supplier_request_suppliers SET supplier_status = 'accepted' WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': request_id, 'supplier_id': supplier_id}
            )
            message = f'Offer accepted for request {request_id}'
            
        elif action == 'reject':
            # Reject the offer and update supplier status
            negotiation.status = 'rejected'
            session.execute(
                text("UPDATE supplier_request_suppliers SET supplier_status = 'rejected' WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': request_id, 'supplier_id': supplier_id}
            )
            message = f'Offer rejected for request {request_id}'
            
        elif action == 'counter':
            # Create a counter offer
            if not counter_offer:
                session.close()
                return jsonify({'error': 'Counter offer details required'}), 400
            
            counter_negotiation = SupplierNegotiation(
                request_id=request_id,
                supplier_id=supplier_id,
                offer_type='counter_offer',
                total_amount=counter_offer.get('total_amount'),
                notes=notes
            )
            session.add(counter_negotiation)
            session.flush()
            
            # Add counter offer items
            for item in counter_offer.get('items', []):
                counter_item = SupplierNegotiationItem(
                    negotiation_id=counter_negotiation.id,
                    product_id=item.get('product_id'),
                    quantity=item.get('quantity'),
                    unit_price=item.get('unit_price'),
                    total_price=item.get('total_price'),
                    specifications=item.get('specifications', ''),
                    notes=item.get('notes', '')
                )
                session.add(counter_item)
            
            # Update supplier status to counter_offered
            session.execute(
                text("UPDATE supplier_request_suppliers SET supplier_status = 'counter_offered' WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': request_id, 'supplier_id': supplier_id}
            )
            message = f'Counter offer sent for request {request_id}'
        
        # Update the main request status
        supplier_request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'message': message
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Get negotiation history for a request
@app.route('/supplier-requests/<int:request_id>/negotiations', methods=['GET'])
@cross_origin()
def get_negotiation_history(request_id):
    """Get all negotiations for a specific request"""
    session = None
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the supplier request
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Get all negotiations for this request
        negotiations = session.query(SupplierNegotiation).filter(
            SupplierNegotiation.request_id == request_id
        ).order_by(SupplierNegotiation.created_at.desc()).all()
        
        negotiations_data = []
        for negotiation in negotiations:
            # Get items for this negotiation
            items = session.query(SupplierNegotiationItem).filter(
                SupplierNegotiationItem.negotiation_id == negotiation.id
            ).all()
            
            items_data = []
            for item in items:
                product = session.query(Product).filter(Product.id == item.product_id).first()
                items_data.append({
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': product.name if product else None,
                    'product_sku': product.sku if product else None,
                    'quantity': item.quantity,
                    'unit_price': item.unit_price,
                    'total_price': item.total_price,
                    'specifications': item.specifications,
                    'notes': item.notes
                })
            
            supplier = session.query(Supplier).filter(Supplier.id == negotiation.supplier_id).first()
            negotiations_data.append({
                'id': negotiation.id,
                'supplier_id': negotiation.supplier_id,
                'supplier_name': supplier.name if supplier else None,
                'offer_type': negotiation.offer_type,
                'total_amount': negotiation.total_amount,
                'notes': negotiation.notes,
                'status': negotiation.status,
                'created_at': negotiation.created_at.isoformat() if negotiation.created_at else None,
                'items': items_data
            })
        
        session.close()
        return jsonify(negotiations_data)
        
    except Exception as e:
        if session:
            session.close()
        return jsonify({'error': str(e)}), 500

# Create invoice for supplier request
@app.route('/supplier-requests/<int:request_id>/invoice', methods=['POST'])
@cross_origin()
def create_supplier_invoice(request_id):
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Check if request exists
        request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Generate invoice number
        import uuid
        invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Calculate totals
        subtotal = data.get('subtotal', 0)
        tax_amount = data.get('tax_amount', 0)
        shipping_amount = data.get('shipping_amount', 0)
        discount_amount = data.get('discount_amount', 0)
        total_amount = subtotal + tax_amount + shipping_amount - discount_amount
        
        # Create invoice
        invoice = SupplierInvoice(
            invoice_number=invoice_number,
            request_id=request_id,
            supplier_id=request.supplier_id,
            issue_date=datetime.fromisoformat(data['issue_date']) if data.get('issue_date') else datetime.now(),
            due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else datetime.now(),
            subtotal=subtotal,
            tax_amount=tax_amount,
            shipping_amount=shipping_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            status=SupplierInvoiceStatus.draft,
            payment_terms=data.get('payment_terms', 'Net 30'),
            notes=data.get('notes'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        session.add(invoice)
        session.flush()  # Get the ID
        
        # Add invoice items
        for item_data in data.get('items', []):
            item = SupplierInvoiceItem(
                invoice_id=invoice.id,
                product_id=item_data['product_id'],
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                total_price=item_data['quantity'] * item_data['unit_price'],
                description=item_data.get('description')
            )
            session.add(item)
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'id': invoice.id,
            'invoice_number': invoice_number
        })
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# Get invoices for a supplier request
@app.route('/supplier-requests/<int:request_id>/invoices', methods=['GET'])
@cross_origin()
def get_supplier_request_invoices(request_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        invoices = session.query(SupplierInvoice).filter(SupplierInvoice.request_id == request_id).all()
        result = []
        
        for invoice in invoices:
            result.append({
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'issue_date': invoice.issue_date.isoformat() if invoice.issue_date else None,
                'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
                'subtotal': invoice.subtotal,
                'tax_amount': invoice.tax_amount,
                'shipping_amount': invoice.shipping_amount,
                'discount_amount': invoice.discount_amount,
                'total_amount': invoice.total_amount,
                'status': invoice.status.value if invoice.status else None,
                'payment_terms': invoice.payment_terms,
                'notes': invoice.notes,
                'created_at': invoice.created_at.isoformat() if invoice.created_at else None
            })
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Get specific invoice with items
@app.route('/supplier-invoices/<int:invoice_id>', methods=['GET'])
@cross_origin()
def get_supplier_invoice(invoice_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        invoice = session.query(SupplierInvoice).filter(SupplierInvoice.id == invoice_id).first()
        if not invoice:
            session.close()
            return jsonify({'error': 'Invoice not found'}), 404
        
        # Get items
        items = session.query(SupplierInvoiceItem).filter(SupplierInvoiceItem.invoice_id == invoice_id).all()
        items_data = []
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).first()
            items_data.append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else None,
                'product_sku': product.sku if product else None,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total_price': item.total_price,
                'description': item.description
            })
        
        result = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'request_id': invoice.request_id,
            'supplier_id': invoice.supplier_id,
            'issue_date': invoice.issue_date.isoformat() if invoice.issue_date else None,
            'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
            'subtotal': invoice.subtotal,
            'tax_amount': invoice.tax_amount,
            'shipping_amount': invoice.shipping_amount,
            'discount_amount': invoice.discount_amount,
            'total_amount': invoice.total_amount,
            'status': invoice.status.value if invoice.status else None,
            'payment_terms': invoice.payment_terms,
            'notes': invoice.notes,
            'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
            'items': items_data
        }
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Update invoice status
@app.route('/supplier-invoices/<int:invoice_id>/status', methods=['PUT'])
@cross_origin()
def update_supplier_invoice_status(invoice_id):
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        invoice = session.query(SupplierInvoice).filter(SupplierInvoice.id == invoice_id).first()
        if not invoice:
            session.close()
            return jsonify({'error': 'Invoice not found'}), 404
        
        new_status = data.get('status')
        if new_status:
            invoice.status = SupplierInvoiceStatus(new_status)
            invoice.updated_at = datetime.now()
        
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# WAREHOUSE-BASED SUPPLIER REQUEST SYSTEM
# ============================================================================

# Get nearby suppliers for a warehouse
@app.route('/suppliers/nearby/<int:warehouse_id>', methods=['GET'])
@cross_origin()
def get_nearby_suppliers(warehouse_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get warehouse coordinates
        warehouse = session.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse or not warehouse.lat or not warehouse.lng:
            session.close()
            return jsonify({'error': 'Warehouse not found or missing coordinates'}), 404
        
        # Get all suppliers with coordinates
        suppliers = session.query(Supplier).filter(
            Supplier.lat.isnot(None),
            Supplier.lng.isnot(None)
        ).all()
        
        # Calculate distances and filter nearby suppliers (within 50km)
        nearby_suppliers = []
        for supplier in suppliers:
            distance = calculate_distance(
                warehouse.lat, warehouse.lng,
                supplier.lat, supplier.lng
            )
            if distance <= 50:  # 50km radius
                nearby_suppliers.append({
                    'id': supplier.id,
                    'name': supplier.name,
                    'company': supplier.company,
                    'email': supplier.email,
                    'phone': supplier.phone,
                    'address': supplier.address,
                    'distance_km': round(distance, 2),
                    'lat': supplier.lat,
                    'lng': supplier.lng
                })
        
        # Sort by distance and return top 3
        nearby_suppliers.sort(key=lambda x: x['distance_km'])
        result = nearby_suppliers[:3]
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Create warehouse-based supplier request
@app.route('/warehouse-requests', methods=['POST'])
@cross_origin()
def create_warehouse_request():
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Generate request number
        request_number = f"WR-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Calculate total predicted amount
        total_predicted_amount = sum(
            item.get('predicted_unit_price', 0) * item.get('quantity_required', 0)
            for item in data.get('items', [])
        )
        
        # Create warehouse request
        warehouse_request = WarehouseRequest(
            request_number=request_number,
            title=data['title'],
            description=data.get('description'),
            requester_id=data['requester_id'],
            project_id=data['project_id'],
            warehouse_id=data['warehouse_id'],
            priority=data.get('priority', 'medium'),
            status=WarehouseRequestStatus.draft,
            required_delivery_date=datetime.fromisoformat(data['required_delivery_date']),
            delivery_address=data.get('delivery_address'),
            total_predicted_amount=total_predicted_amount,
            notes=data.get('notes'),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        session.add(warehouse_request)
        session.flush()  # Get the ID
        
        # Add request items
        for item_data in data.get('items', []):
            predicted_total = item_data.get('predicted_unit_price', 0) * item_data.get('quantity_required', 0)
            item = WarehouseRequestItem(
                request_id=warehouse_request.id,
                product_id=item_data['product_id'],
                quantity_required=item_data['quantity_required'],
                predicted_unit_price=item_data.get('predicted_unit_price', 0),
                predicted_total_price=predicted_total,
                specifications=item_data.get('specifications'),
                priority=item_data.get('priority', 'normal'),
                notes=item_data.get('notes')
            )
            session.add(item)
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'id': warehouse_request.id,
            'request_number': request_number
        })
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# Get warehouse requests
@app.route('/warehouse-requests', methods=['GET'])
@cross_origin()
def get_warehouse_requests():
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        requests = session.query(WarehouseRequest).all()
        result = []
        
        for req in requests:
            # Get project and warehouse info
            project = session.query(Project).filter(Project.id == req.project_id).first()
            warehouse = session.query(Warehouse).filter(Warehouse.id == req.warehouse_id).first()
            requester = session.query(User).filter(User.id == req.requester_id).first()
            
            # Get items count
            items_count = session.query(WarehouseRequestItem).filter(
                WarehouseRequestItem.request_id == req.id
            ).count()
            
            # Get quotes count
            quotes_count = session.query(SupplierQuote).filter(
                SupplierQuote.request_id == req.id
            ).count()
            
            result.append({
                'id': req.id,
                'request_number': req.request_number,
                'title': req.title,
                'description': req.description,
                'requester_id': req.requester_id,
                'requester_name': requester.username if requester else None,
                'project_id': req.project_id,
                'project_name': project.name if project else None,
                'warehouse_id': req.warehouse_id,
                'warehouse_name': warehouse.name if warehouse else None,
                'priority': req.priority,
                'status': req.status.value if req.status else None,
                'required_delivery_date': req.required_delivery_date.isoformat() if req.required_delivery_date else None,
                'delivery_address': req.delivery_address,
                'total_predicted_amount': req.total_predicted_amount,
                'notes': req.notes,
                'items_count': items_count,
                'quotes_count': quotes_count,
                'created_at': req.created_at.isoformat() if req.created_at else None,
                'updated_at': req.updated_at.isoformat() if req.updated_at else None
            })
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Get specific warehouse request with items
@app.route('/warehouse-requests/<int:request_id>', methods=['GET'])
@cross_origin()
def get_warehouse_request(request_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        request = session.query(WarehouseRequest).filter(WarehouseRequest.id == request_id).first()
        if not request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Get project and warehouse info
        project = session.query(Project).filter(Project.id == request.project_id).first()
        warehouse = session.query(Warehouse).filter(Warehouse.id == request.warehouse_id).first()
        requester = session.query(User).filter(User.id == request.requester_id).first()
        
        # Get items
        items = session.query(WarehouseRequestItem).filter(
            WarehouseRequestItem.request_id == request_id
        ).all()
        items_data = []
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).first()
            items_data.append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else None,
                'product_sku': product.sku if product else None,
                'quantity_required': item.quantity_required,
                'predicted_unit_price': item.predicted_unit_price,
                'predicted_total_price': item.predicted_total_price,
                'specifications': item.specifications,
                'priority': item.priority,
                'notes': item.notes
            })
        
        result = {
            'id': request.id,
            'request_number': request.request_number,
            'title': request.title,
            'description': request.description,
            'requester_id': request.requester_id,
            'requester_name': requester.username if requester else None,
            'project_id': request.project_id,
            'project_name': project.name if project else None,
            'warehouse_id': request.warehouse_id,
            'warehouse_name': warehouse.name if warehouse else None,
            'priority': request.priority,
            'status': request.status.value if request.status else None,
            'required_delivery_date': request.required_delivery_date.isoformat() if request.required_delivery_date else None,
            'delivery_address': request.delivery_address,
            'total_predicted_amount': request.total_predicted_amount,
            'notes': request.notes,
            'created_at': request.created_at.isoformat() if request.created_at else None,
            'updated_at': request.updated_at.isoformat() if request.updated_at else None,
            'items': items_data
        }
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Update warehouse request status
@app.route('/warehouse-requests/<int:request_id>/status', methods=['PUT'])
@cross_origin()
def update_warehouse_request_status(request_id):
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        request = session.query(WarehouseRequest).filter(WarehouseRequest.id == request_id).first()
        if not request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        new_status = data.get('status')
        if new_status:
            request.status = WarehouseRequestStatus(new_status)
            request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# Create supplier quote for warehouse request
@app.route('/supplier-quotes', methods=['POST'])
@cross_origin()
def create_supplier_quote():
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Generate quote number
        quote_number = f"SQ-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Calculate totals
        total_amount = sum(
            item.get('unit_price', 0) * item.get('quantity', 0)
            for item in data.get('items', [])
        )
        delivery_cost = data.get('delivery_cost', 0)
        tax_amount = data.get('tax_amount', 0)
        total_with_tax = total_amount + delivery_cost + tax_amount
        
        # Create supplier quote
        quote = SupplierQuote(
            quote_number=quote_number,
            request_id=data['request_id'],
            supplier_id=data['supplier_id'],
            total_amount=total_amount,
            delivery_cost=delivery_cost,
            tax_amount=tax_amount,
            total_with_tax=total_with_tax,
            estimated_delivery_date=datetime.fromisoformat(data['estimated_delivery_date']) if data.get('estimated_delivery_date') else None,
            delivery_terms=data.get('delivery_terms'),
            status=SupplierQuoteStatus.pending.value,
            expires_at=datetime.fromisoformat(data['expires_at']) if data.get('expires_at') else None,
            notes=data.get('notes'),
            terms_conditions=data.get('terms_conditions'),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            fulfillment_date=datetime.fromisoformat(data['fulfillment_date']) if data.get('fulfillment_date') else None
        )
        
        session.add(quote)
        session.flush()  # Get the ID
        
        # Add quote items
        for item_data in data.get('items', []):
            total_price = item_data.get('unit_price', 0) * item_data.get('quantity', 0)
            item = SupplierQuoteItem(
                quote_id=quote.id,
                product_id=item_data['product_id'],
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                total_price=total_price,
                available_stock=item_data.get('available_stock', 0),
                lead_time_days=item_data.get('lead_time_days', 0),
                specifications=item_data.get('specifications'),
                notes=item_data.get('notes')
            )
            session.add(item)
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'id': quote.id,
            'quote_number': quote_number
        })
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# Get supplier quotes for a warehouse request
@app.route('/warehouse-requests/<int:request_id>/quotes', methods=['GET'])
@cross_origin()
def get_warehouse_request_quotes(request_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        quotes = session.query(SupplierQuote).filter(SupplierQuote.request_id == request_id).all()
        result = []
        
        for quote in quotes:
            supplier = session.query(Supplier).filter(Supplier.id == quote.supplier_id).first()
            
            # Get items count
            items_count = session.query(SupplierQuoteItem).filter(
                SupplierQuoteItem.quote_id == quote.id
            ).count()
            
            result.append({
                'id': quote.id,
                'quote_number': quote.quote_number,
                'supplier_id': quote.supplier_id,
                'supplier_name': supplier.name if supplier else None,
                'supplier_company': supplier.company if supplier else None,
                'total_amount': quote.total_amount,
                'delivery_cost': quote.delivery_cost,
                'tax_amount': quote.tax_amount,
                'total_with_tax': quote.total_with_tax,
                'estimated_delivery_date': quote.estimated_delivery_date.isoformat() if quote.estimated_delivery_date else None,
                'delivery_terms': quote.delivery_terms,
                'status': quote.status.value if quote.status else None,
                'submitted_at': quote.submitted_at.isoformat() if quote.submitted_at else None,
                'expires_at': quote.expires_at.isoformat() if quote.expires_at else None,
                'notes': quote.notes,
                'items_count': items_count,
                'created_at': quote.created_at.isoformat() if quote.created_at else None
            })
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Get specific supplier quote with items
@app.route('/supplier-quotes/<int:quote_id>', methods=['GET'])
@cross_origin()
def get_supplier_quote(quote_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        quote = session.query(SupplierQuote).filter(SupplierQuote.id == quote_id).first()
        if not quote:
            session.close()
            return jsonify({'error': 'Quote not found'}), 404
        
        supplier = session.query(Supplier).filter(Supplier.id == quote.supplier_id).first()
        
        # Get items
        items = session.query(SupplierQuoteItem).filter(
            SupplierQuoteItem.quote_id == quote_id
        ).all()
        items_data = []
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).first()
            items_data.append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else None,
                'product_sku': product.sku if product else None,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total_price': item.total_price,
                'available_stock': item.available_stock,
                'lead_time_days': item.lead_time_days,
                'specifications': item.specifications,
                'notes': item.notes
            })
        
        result = {
            'id': quote.id,
            'quote_number': quote.quote_number,
            'request_id': quote.request_id,
            'supplier_id': quote.supplier_id,
            'supplier_name': supplier.name if supplier else None,
            'supplier_company': supplier.company if supplier else None,
            'total_amount': quote.total_amount,
            'delivery_cost': quote.delivery_cost,
            'tax_amount': quote.tax_amount,
            'total_with_tax': quote.total_with_tax,
            'estimated_delivery_date': quote.estimated_delivery_date.isoformat() if quote.estimated_delivery_date else None,
            'delivery_terms': quote.delivery_terms,
            'status': quote.status.value if quote.status else None,
            'submitted_at': quote.submitted_at.isoformat() if quote.submitted_at else None,
            'expires_at': quote.expires_at.isoformat() if quote.expires_at else None,
            'accepted_at': quote.accepted_at.isoformat() if quote.accepted_at else None,
            'rejected_at': quote.rejected_at.isoformat() if quote.rejected_at else None,
            'notes': quote.notes,
            'terms_conditions': quote.terms_conditions,
            'created_at': quote.created_at.isoformat() if quote.created_at else None,
            'updated_at': quote.updated_at.isoformat() if quote.updated_at else None,
            'items': items_data
        }
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# Update supplier quote status
@app.route('/supplier-quotes/<int:quote_id>/status', methods=['PUT'])
@cross_origin()
def update_supplier_quote_status(quote_id):
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        quote = session.query(SupplierQuote).filter(SupplierQuote.id == quote_id).first()
        if not quote:
            session.close()
            return jsonify({'error': 'Quote not found'}), 404
        
        new_status = data.get('status')
        if new_status:
            quote.status = SupplierQuoteStatus(new_status)
            quote.updated_at = datetime.now()
            
            # Set accepted_at or rejected_at timestamp
            if new_status == 'accepted':
                quote.accepted_at = datetime.now()
            elif new_status == 'rejected':
                quote.rejected_at = datetime.now()
        
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

# Get warehouse requests for suppliers
@app.route('/warehouse-requests/supplier/<int:supplier_id>', methods=['GET'])
@cross_origin()
def get_warehouse_requests_for_supplier(supplier_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get requests that are sent to suppliers
        requests = session.query(WarehouseRequest).filter(
            WarehouseRequest.status.in_([
                WarehouseRequestStatus.sent_to_suppliers,
                WarehouseRequestStatus.suppliers_reviewing,
                WarehouseRequestStatus.supplier_quoted
            ])
        ).all()
        
        result = []
        for req in requests:
            # Check if this supplier is nearby (within 50km)
            warehouse = session.query(Warehouse).filter(Warehouse.id == req.warehouse_id).first()
            supplier = session.query(Supplier).filter(Supplier.id == supplier_id).first()
            
            if warehouse and supplier and warehouse.lat and warehouse.lng and supplier.lat and supplier.lng:
                distance = calculate_distance(
                    warehouse.lat, warehouse.lng,
                    supplier.lat, supplier.lng
                )
                
                if distance <= 50:  # Only show requests within 50km
                    project = session.query(Project).filter(Project.id == req.project_id).first()
                    
                    # Check if supplier already submitted a quote
                    existing_quote = session.query(SupplierQuote).filter(
                        SupplierQuote.request_id == req.id,
                        SupplierQuote.supplier_id == supplier_id
                    ).first()
                    
                    result.append({
                        'id': req.id,
                        'request_number': req.request_number,
                        'title': req.title,
                        'description': req.description,
                        'project_id': req.project_id,
                        'project_name': project.name if project else None,
                        'warehouse_id': req.warehouse_id,
                        'warehouse_name': warehouse.name if warehouse else None,
                        'distance_km': round(distance, 2),
                        'priority': req.priority,
                        'status': req.status.value if req.status else None,
                        'required_delivery_date': req.required_delivery_date.isoformat() if req.required_delivery_date else None,
                        'total_predicted_amount': req.total_predicted_amount,
                        'notes': req.notes,
                        'has_quoted': existing_quote is not None,
                        'quote_id': existing_quote.id if existing_quote else None,
                        'created_at': req.created_at.isoformat() if req.created_at else None
                    })
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/finished_products/<int:fp_id>/materials', methods=['GET'])
def get_finished_product_materials(fp_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Query the breakdown from finished_product_materials with price information
        from sqlalchemy import text
        rows = session.execute(text('''
            SELECT p.name, p.sku, fpm.quantity, p.unit, p.cost, (fpm.quantity * p.cost) as total_cost
            FROM finished_product_materials fpm
            JOIN products p ON fpm.material_id = p.id
            WHERE fpm.finished_product_id = :fp_id
        '''), {'fp_id': fp_id}).fetchall()
        
        # Get skills for this finished product
        skills = session.query(FinishedProductSkill).filter(
            FinishedProductSkill.finished_product_id == fp_id
        ).all()
        
        skill_names = []
        for skill_rel in skills:
            skill = session.query(Skill).filter(Skill.id == skill_rel.skill_id).first()
            if skill:
                skill_names.append(skill.name)
        
        result = {
            'materials': [
                {
                    'name': row[0], 
                    'sku': row[1],
                    'quantity': row[2], 
                    'unit': row[3],
                    'unit_cost': row[4],
                    'total_cost': row[5]
                } for row in rows
            ],
            'skills': skill_names,
            'total_materials_cost': sum(row[5] for row in rows) if rows else 0
        }
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/finished_products/<int:fp_id>', methods=['PUT'])
@cross_origin()
def update_finished_product(fp_id):
    try:
        data = request.get_json()
        model_name = data.get('model_name')
        total_cost = data.get('total_cost', 0)
        materials_cost = data.get('materials_cost', 0)
        labor_cost = data.get('labor_cost', 0)
        photo_url = data.get('photo_url')
        skills = data.get('skills', [])
        materials = data.get('materials', [])
        
        if not model_name:
            return jsonify({'error': 'Model name required'}), 400
            
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the finished product
        fp = session.query(FinishedProduct).filter_by(id=fp_id).first()
        if not fp:
            session.close()
            return jsonify({'error': 'Finished product not found'}), 404
        
        # Calculate costs based on materials
        materials_cost = 0
        for m in materials:
            if not m.get('id') or not m.get('quantity'):
                continue
            # Get material cost from products table
            material_product = session.query(Product).filter_by(id=m['id']).first()
            if material_product and material_product.cost:
                materials_cost += material_product.cost * m['quantity']
        
        total_calculated_cost = materials_cost + labor_cost
        
        # Update basic fields
        fp.model_name = model_name
        fp.total_cost = total_calculated_cost
        fp.photo_url = photo_url
        fp.phase_type = data.get('phase_type')
        fp.mount_type = data.get('mount_type')
        fp.compliance_tags = json.dumps(data.get('compliance_tags', [])) if data.get('compliance_tags') else None
        fp.features = json.dumps(data.get('features', [])) if data.get('features') else None
        fp.application_tags = json.dumps(data.get('application_tags', [])) if data.get('application_tags') else None
        fp.voltage_rating = data.get('voltage_rating')
        fp.min_load_kw = data.get('min_load_kw')
        fp.max_load_kw = data.get('max_load_kw')
        fp.estimated_hours = data.get('estimated_hours', 1)
        
        # Update materials JSON
        fp.materials_json = json.dumps([
            {"material_id": m["id"], "name": m.get("name"), "quantity": m["quantity"]}
            for m in materials if m.get("id") and m.get("quantity")
        ]) if materials else None
        
        # Clear existing relationships
        session.query(FinishedProductSkill).filter_by(finished_product_id=fp_id).delete()
        session.query(FinishedProductMaterial).filter_by(finished_product_id=fp_id).delete()
        
        # Add new skills
        skill_names = []
        for skill in skills:
            if isinstance(skill, int):
                skill_obj = session.query(Skill).filter_by(id=skill).first()
            else:
                skill_obj = session.query(Skill).filter_by(name=skill).first()
                if not skill_obj:
                    skill_obj = Skill(name=skill)
                    session.add(skill_obj)
                    session.flush()
            if skill_obj:
                fps = FinishedProductSkill(finished_product_id=fp_id, skill_id=skill_obj.id)
                session.add(fps)
                skill_names.append(skill_obj.name)
        
        # Add new materials
        for m in materials:
            if not m.get('id') or not m.get('quantity'):
                continue
            fpm = FinishedProductMaterial(finished_product_id=fp_id, material_id=m['id'], quantity=m['quantity'])
            session.add(fpm)
        
        session.commit()
        session.close()
        
        return jsonify({'success': True, 'message': 'Finished product updated successfully'})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/finished_products/<int:fp_id>', methods=['DELETE'])
@cross_origin()
def delete_finished_product(fp_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the finished product
        fp = session.query(FinishedProduct).filter_by(id=fp_id).first()
        if not fp:
            session.close()
            return jsonify({'error': 'Finished product not found'}), 404
        
        # Delete related records first
        session.query(FinishedProductSkill).filter_by(finished_product_id=fp_id).delete()
        session.query(FinishedProductMaterial).filter_by(finished_product_id=fp_id).delete()
        
        # Delete the finished product
        session.delete(fp)
        session.commit()
        session.close()
        
        return jsonify({'success': True, 'message': 'Finished product deleted successfully'})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/calculate-labor-cost', methods=['POST'])
@cross_origin()
def calculate_labor_cost():
    try:
        data = request.get_json()
        skills = data.get('skills', [])
        estimated_hours = data.get('estimated_hours', 1)
        
        if not skills:
            return jsonify({'labor_cost': 0, 'message': 'No skills provided'})
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        total_labor_cost = 0
        skill_breakdown = []
        
        for skill_name in skills:
            # Find employees with this skill
            employees_with_skill = session.query(Employee).filter(
                Employee.skills.like(f"%{skill_name}%"),
                Employee.is_available == True
            ).all()
            
            if employees_with_skill:
                # Calculate average hourly rate for this skill
                avg_hourly_rate = sum(emp.hourly_rate for emp in employees_with_skill) / len(employees_with_skill)
                skill_cost = avg_hourly_rate * estimated_hours
                total_labor_cost += skill_cost
                
                skill_breakdown.append({
                    'skill': skill_name,
                    'avg_hourly_rate': avg_hourly_rate,
                    'employees_count': len(employees_with_skill),
                    'skill_cost': skill_cost
                })
            else:
                # Use a default rate if no employees have this skill
                default_rate = 20.0  # Default hourly rate
                skill_cost = default_rate * estimated_hours
                total_labor_cost += skill_cost
                
                skill_breakdown.append({
                    'skill': skill_name,
                    'avg_hourly_rate': default_rate,
                    'employees_count': 0,
                    'skill_cost': skill_cost,
                    'note': 'No employees with this skill, using default rate'
                })
        
        session.close()
        
        return jsonify({
            'labor_cost': total_labor_cost,
            'skill_breakdown': skill_breakdown,
            'estimated_hours': estimated_hours,
            'message': f'Calculated labor cost for {len(skills)} skills'
        })
        
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

ALLOWED_ORIGINS = ["http://localhost:5173"]

@app.route('/materials', methods=['GET'])
def get_materials():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        products = session.query(Product).filter(Product.supplier_id == None).all()
        result = []
        for product in products:
            # Ensure reorder_level and quantity are floats, default 0 if None
            reorder_level = product.reorder_level if product.reorder_level is not None else 0.0
            # Sum all supplier_products.current_stock for this material
            supplier_products = session.query(SupplierProduct).filter_by(product_id=product.id, is_active=True).all()
            if supplier_products:
                quantity = sum([sp.current_stock or 0 for sp in supplier_products])
            else:
                quantity = product.quantity if product.quantity is not None else 0.0
            # Calculate status
            if quantity == 0:
                stock_status = 'out_of_stock'
            elif quantity <= reorder_level:
                stock_status = 'low_stock'
            else:
                stock_status = 'in_stock'
            # Supplier info
            supplier_info = None
            if product.supplier_id:
                supplier = session.query(Supplier).filter_by(id=product.supplier_id).first()
                if supplier:
                    supplier_info = {
                        'id': supplier.id,
                        'name': supplier.name,
                        'company': supplier.company,
                        'email': supplier.email,
                        'phone': supplier.phone,
                        'address': supplier.address
                    }
            result.append({
                'id': product.id,
                'name': product.name,
                'sku': product.sku,
                'category': product.category,
                'type': product.category,  # for frontend clarity
                'quantity': quantity,
                'unit': product.unit,
                'cost': product.cost,
                'reorder_level': reorder_level,
                'supplier_id': product.supplier_id,
                'conversion_ratio': product.conversion_ratio,
                'last_updated': product.last_updated.isoformat() if product.last_updated else None,
                'email_sent_count': product.email_sent_count,
                'photo_url': product.photo_url,
                'description': product.description,
                'skills': [s.name for s in product.skills] if hasattr(product, 'skills') and product.skills else [],
                'stock_status': stock_status,
                'supplier_info': supplier_info
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/materials/<int:material_id>', methods=['PUT'])
@cross_origin()
def update_material(material_id):
    try:
        data = request.get_json()
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        material = session.query(Product).filter_by(id=material_id).first()
        if not material:
            session.close()
            return jsonify({'error': 'Material not found'}), 404
        
        # Update basic fields
        if 'name' in data:
            material.name = data['name']
        if 'sku' in data:
            material.sku = data['sku']
        if 'category' in data:
            material.category = data['category']
        if 'cost' in data:
            material.cost = data['cost']
        if 'unit' in data:
            material.unit = data['unit']
        if 'description' in data:
            material.description = data['description']
        if 'photo_url' in data:
            material.photo_url = data['photo_url']
        
        # Update skills
        if 'skills' in data:
            # Clear existing skills
            material.skills.clear()
            
            # Add new skills
            for skill_name in data['skills']:
                skill = session.query(Skill).filter_by(name=skill_name).first()
                if not skill:
                    skill = Skill(name=skill_name)
                    session.add(skill)
                    session.flush()
                material.skills.append(skill)
        
        session.commit()
        
        # Get updated skills for response
        skills = [skill.name for skill in material.skills]
        
        result = {
            'id': material.id,
            'name': material.name,
            'sku': material.sku,
            'category': material.category,
            'cost': material.cost,
            'unit': material.unit,
            'description': material.description,
            'photo_url': material.photo_url,
            'skills': skills
        }
        
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/materials/<int:material_id>', methods=['DELETE'])
@cross_origin()
def delete_material(material_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        material = session.query(Product).filter_by(id=material_id).first()
        if not material:
            session.close()
            return jsonify({'error': 'Material not found'}), 404
        
        # Check if material is used in any finished products
        from sqlalchemy import text
        usage_check = session.execute(text('''
            SELECT COUNT(*) as count FROM finished_product_materials 
            WHERE material_id = :material_id
        '''), {'material_id': material_id}).fetchone()
        
        if usage_check[0] > 0:
            session.close()
            return jsonify({'error': 'Cannot delete material that is used in finished products'}), 400
        
        # Delete the material
        session.delete(material)
        session.commit()
        session.close()
        
        return jsonify({'message': 'Material deleted successfully'})
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/materials/upload-photo', methods=['POST'])
def upload_material_photo():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    # Validate file type
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
        return jsonify({'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WEBP'}), 400
    # Validate file size (5MB limit)
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)
    if file_size > 5 * 1024 * 1024:
        return jsonify({'error': 'File too large. Maximum size: 5MB'}), 400
    from werkzeug.utils import secure_filename
    import time
    filename = secure_filename(file.filename)
    timestamp = int(time.time())
    name, ext = os.path.splitext(filename)
    filename = f"{name}_{timestamp}{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    url = f'/static/product_photos/{filename}'
    return jsonify({'url': url})

# Load truck cost model at startup
try:
    with open("chosen_truck_cost_model.json", "r", encoding="utf-8") as f:
        TRUCK_COST_CFG = json.load(f)
except Exception:
    TRUCK_COST_CFG = None

def predict_truck_cost(distance_km: float) -> float:
    if not TRUCK_COST_CFG:
        return 0.0
    name = TRUCK_COST_CFG["model_name"]
    params = TRUCK_COST_CFG["params"]
    d = float(distance_km)
    if name == "linear":
        return params["F"] + params["v"] * d
    elif name == "exp_decay":
        return d * (params["c_min"] + (params["c0"] - params["c_min"]) * math.exp(-params["k"] * d))
    elif name == "piecewise":
        b1 = params["b1"]; b2 = params["b2"]
        seg1 = min(d, b1)
        seg2 = 0.0 if d <= b1 else min(d - b1, b2 - b1)
        seg3 = 0.0 if d <= b2 else d - b2
        return (params["F"] + params["m1"] * seg1 + params["m2"] * seg2 + params["m3"] * seg3)
    else:
        return 0.0

def calculate_supplier_shipping_cost(supplier_id: int, delivery_address: str = None, subtotal: float = 0, product_category: str = None) -> dict:
    """
    Calculate shipping cost and taxes for a specific supplier based on their location
    Returns: {'distance_km': float, 'shipping_cost': float, 'supplier_location': str, 'tax_breakdown': dict, 'grand_total': float}
    """
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get supplier information
        supplier = session.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier:
            session.close()
            return {
                'error': 'Supplier not found',
                'distance_km': None,
                'shipping_cost': None,
                'supplier_location': 'Unknown',
                'tax_breakdown': None,
                'grand_total': None,
                'tax_display': None
            }
        # Warehouse location (Pune, India) - main warehouse
        warehouse_lat, warehouse_lng = 18.5204, 73.8567
        # Try to get supplier coordinates
        if supplier.lat and supplier.lng:
            supplier_lat, supplier_lng = supplier.lat, supplier.lng
        else:
            # Geocode supplier address if coordinates not available
            try:
                if supplier.address:
                    geocode_url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{supplier.address}.json?access_token={MAPBOX_TOKEN}&country=IN"
                    print('DEBUG: Mapbox geocode URL:', geocode_url)
                    geocode_response = requests.get(geocode_url)
                    geocode_data = geocode_response.json()
                    print('DEBUG: Mapbox geocode response:', geocode_data)
                    if geocode_data.get('features') and len(geocode_data['features']) > 0:
                        supplier_lng, supplier_lat = geocode_data['features'][0]['center']
                        print('DEBUG: Saving lat/lng to supplier:', supplier_lat, supplier_lng)
                        # Update supplier coordinates in database
                        supplier.lat = supplier_lat
                        supplier.lng = supplier_lng
                        session.commit()
                    else:
                        print('DEBUG: No features found in geocode response')
                        session.close()
                        return {
                            'error': 'Could not geocode supplier address',
                            'distance_km': None,
                            'shipping_cost': None,
                            'supplier_location': supplier.address or 'Unknown',
                            'tax_breakdown': None,
                            'grand_total': None,
                            'tax_display': None
                        }
                else:
                    print('DEBUG: Supplier address missing')
                    session.close()
                    return {
                        'error': 'Supplier address missing',
                        'distance_km': None,
                        'shipping_cost': None,
                        'supplier_location': 'Unknown',
                        'tax_breakdown': None,
                        'grand_total': None,
                        'tax_display': None
                    }
            except Exception as e:
                print(f"DEBUG: Exception during Mapbox geocoding: {e}")
                session.close()
                return {
                    'error': f'Error geocoding supplier address: {e}',
                    'distance_km': None,
                    'shipping_cost': None,
                    'supplier_location': supplier.address or 'Unknown',
                    'tax_breakdown': None,
                    'grand_total': None,
                    'tax_display': None
                }
        # Calculate distance using Haversine formula
        R = 6371  # Earth's radius in kilometers
        lat1, lng1, lat2, lng2 = map(radians, [warehouse_lat, warehouse_lng, supplier_lat, supplier_lng])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance_km = R * c
        shipping_cost = predict_truck_cost(distance_km)
        tax_calculation = tax_calculator.calculate_total_with_taxes(
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            supplier_address=supplier.address or 'Unknown',
            product_category=product_category
        )
        session.close()
        return {
            'distance_km': round(distance_km, 2),
            'shipping_cost': round(shipping_cost, 2),
            'supplier_location': supplier.address or 'Unknown',
            'tax_breakdown': tax_calculation['tax_breakdown'],
            'grand_total': tax_calculation['grand_total'],
            'tax_display': tax_calculation['breakdown_display']
        }
    except Exception as e:
        print(f"Error calculating supplier shipping cost: {e}")
        import traceback
        traceback.print_exc()
        distance_km = 500
        shipping_cost = predict_truck_cost(distance_km)
        tax_calculation = tax_calculator.calculate_total_with_taxes(
            subtotal=subtotal,
            shipping_cost=shipping_cost,
            supplier_address='Unknown',
            product_category=product_category
        )
        return {
            'distance_km': distance_km,
            'shipping_cost': shipping_cost,
            'supplier_location': 'Error calculating',
            'tax_breakdown': tax_calculation['tax_breakdown'],
            'grand_total': tax_calculation['grand_total'],
            'tax_display': tax_calculation['breakdown_display']
        }

@app.route('/predict_truck_cost', methods=['GET'])
def predict_truck_cost_api():
    distance_km = float(request.args.get('distance_km', 0))
    print(f'Predicting truck cost for distance: {distance_km}')
    cost = predict_truck_cost(distance_km)
    print(f'Predicted cost: {cost}')
    return jsonify({'distance_km': distance_km, 'predicted_cost_inr': cost})

@app.route('/supplier-shipping-cost/<int:supplier_id>', methods=['GET'])
@cross_origin()
def get_supplier_shipping_cost(supplier_id):
    """Get shipping cost and taxes for a specific supplier"""
    try:
        delivery_address = request.args.get('delivery_address', '')
        subtotal = float(request.args.get('subtotal', 0))
        product_category = request.args.get('product_category', 'machinery')
        
        print(f"API call: supplier_id={supplier_id}, subtotal={subtotal}, category={product_category}")
        
        shipping_info = calculate_supplier_shipping_cost(
            supplier_id, 
            delivery_address, 
            subtotal, 
            product_category
        )
        
        print(f"Shipping info returned: {shipping_info}")
        return jsonify(shipping_info)
    except Exception as e:
        print(f"Error in API: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/calculate-delivery-distance', methods=['GET'])
@cross_origin()
def calculate_delivery_distance():
    """
    Calculate distance from warehouse to delivery address.
    Query params: delivery_address or address
    Response: distance_km, delivery_coordinates, warehouse_coordinates
    """
    delivery_address = request.args.get('delivery_address') or request.args.get('address', '')
    if not delivery_address:
        return jsonify({'error': 'Delivery address required'}), 400
    
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
    
    try:
        # Check if the address contains any known city names
        address_lower = delivery_address.lower()
        matched_city = None
        matched_coords = None
        
        for city, coords in city_coordinates.items():
            if city in address_lower:
                matched_city = city
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
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance_km = R * c
            
            return jsonify({
                'distance_km': round(distance_km, 2),
                'delivery_coordinates': {'lat': delivery_lat, 'lng': delivery_lng},
                'warehouse_coordinates': {'lat': warehouse_lat, 'lng': warehouse_lng},
                'delivery_address': delivery_address,
                'geocoded_address': f"{matched_city.title()}, India"
            })
        else:
            # Fallback: estimate distance based on address length and provide approximate coordinates
            # This is a rough estimation for addresses we can't geocode
            estimated_distance = len(delivery_address) * 0.5 + 50  # Rough estimation
            estimated_lat = warehouse_lat + (len(delivery_address) % 10 - 5) * 0.1
            estimated_lng = warehouse_lng + (len(delivery_address) % 10 - 5) * 0.1
            
            return jsonify({
                'distance_km': round(estimated_distance, 2),
                'delivery_coordinates': {'lat': estimated_lat, 'lng': estimated_lng},
                'warehouse_coordinates': {'lat': warehouse_lat, 'lng': warehouse_lng},
                'delivery_address': delivery_address,
                'geocoded_address': delivery_address,
                'note': 'Distance is estimated (geocoding not available)'
            })
            
    except Exception as e:
        print(f"Error calculating delivery distance: {e}")
        return jsonify({'error': 'Distance calculation failed'}), 500

@app.route('/materials/<int:material_id>/price_history', methods=['GET'])
@cross_origin()
def material_price_history(material_id):
    import random
    from datetime import datetime, timedelta
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    from sqlalchemy import text
    rows = session.execute(
        text("""
        SELECT DATE_FORMAT(t.date, '%Y-%m') AS month, AVG(p.cost) AS avg_price
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        WHERE t.type = 'stock_in' AND t.product_id = :mid
        GROUP BY month
        ORDER BY month
        """), {'mid': material_id}
    ).fetchall()
    session.close()
    if rows and len(rows) > 0:
        return jsonify([{'month': row[0], 'price': float(row[1])} for row in rows])
    # If no data, generate 12 months of random prices
    today = datetime.today()
    base_price = random.uniform(50, 200)  # Sensible base price
    data = []
    for i in range(12, 0, -1):
        month = (today.replace(day=1) - timedelta(days=30*i)).strftime('%Y-%m')
        # Simulate some price fluctuation
        price = base_price + random.uniform(-0.15, 0.15) * base_price + random.uniform(-5, 5)
        price = max(10, round(price, 2))
        data.append({'month': month, 'price': price})
    data.sort(key=lambda x: x['month'])
    return jsonify(data)

@app.route('/materials/<int:material_id>/demand_history', methods=['GET'])
@cross_origin()
def material_demand_history(material_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    from sqlalchemy import text
    rows = session.execute(
        text("""
        SELECT DATE_FORMAT(date, '%Y-%m') AS month, SUM(quantity) AS total_demand
        FROM transactions
        WHERE type = 'stock_out' AND product_id = :mid
        GROUP BY month
        ORDER BY month
        """), {'mid': material_id}
    ).fetchall()
    session.close()
    return jsonify([{'month': row[0], 'demand': float(row[1])} for row in rows])

@app.route('/holidays', methods=['GET'])
def get_holidays():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    holidays = session.query(CompanyHoliday).all()
    result = [{'id': h.id, 'name': h.name, 'date': h.date.isoformat()} for h in holidays]
    session.close()
    return jsonify(result)

@app.route('/projects/predict-end-date', methods=['POST'])
def predict_project_end_date():
    project_data = request.json
    try:
        predicted_date = calculate_project_end_date(project_data)
        return jsonify({'predicted_end_date': predicted_date.isoformat()})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Smart Product Recommendation API ---
@app.route('/match-products', methods=['POST'])
@cross_origin()
def match_products():
    """
    Request JSON: {
      "application": "Auto DG-Solar Switch",
      "power_load_kw": 120,
      "voltage_rating": 415,
      "phase_type": "3-phase",
      "mount_type": "Outdoor",
      "compliance": "IS-8623",
      "preferred_features": "Remote monitoring"
    }
    Response: List of matched products with scores and explanations
    """
    data = request.get_json()
    result = match_products_to_requirements(data)
    return jsonify({'matches': result})

# --- Price Breakdown API ---
@app.route('/price-breakdown', methods=['GET'])
def price_breakdown():
    """
    Query params: product_id, qty, install (bool), delivery_address (optional)
    Response: Detailed price breakdown
    """
    product_id = int(request.args.get('product_id'))
    qty = int(request.args.get('qty', 1))
    install = request.args.get('install', 'false').lower() == 'true'
    delivery_address = request.args.get('delivery_address', '')
    result = generate_price_breakdown(product_id, qty, install, delivery_address)
    return jsonify(result)

@app.route('/finished_products/filters', methods=['GET'])
@cross_origin()
def get_finished_product_filters():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        # Get all unique values for each field
        phase_types = sorted(set(row[0] for row in session.query(FinishedProduct.phase_type).distinct() if row[0]))
        mount_types = sorted(set(row[0] for row in session.query(FinishedProduct.mount_type).distinct() if row[0]))
        voltage_ratings = sorted(set(row[0] for row in session.query(FinishedProduct.voltage_rating).distinct() if row[0] is not None))
        min_load_kws = sorted(set(row[0] for row in session.query(FinishedProduct.min_load_kw).distinct() if row[0] is not None))
        max_load_kws = sorted(set(row[0] for row in session.query(FinishedProduct.max_load_kw).distinct() if row[0] is not None))
        # For tags, use master tables
        compliance_tags = [tag.name for tag in session.query(ComplianceTag).order_by(ComplianceTag.name).all()]
        features = [feature.name for feature in session.query(Feature).order_by(Feature.name).all()]
        # Application tags still from finished products (unless you want a master table for these too)
        def get_unique_tags(column):
            tags = set()
            for row in session.query(column).distinct():
                if row[0]:
                    try:
                        tags.update(json.loads(row[0]))
                    except Exception:
                        pass
            return sorted(tags)
        application_tags = get_unique_tags(FinishedProduct.application_tags)
        session.close()
        return jsonify({
            'phase_types': phase_types,
            'mount_types': mount_types,
            'compliance_tags': compliance_tags,
            'features': features,
            'application_tags': application_tags,
            'voltage_ratings': voltage_ratings,
            'min_load_kws': min_load_kws,
            'max_load_kws': max_load_kws
        })
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/features', methods=['GET'])
@cross_origin()
def get_features():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    features = session.query(Feature).all()
    result = [{'id': f.id, 'name': f.name} for f in features]
    session.close()
    return jsonify(result)

@app.route('/features', methods=['POST'])
@cross_origin()
def add_feature():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    if session.query(Feature).filter_by(name=name).first():
        session.close()
        return jsonify({'error': 'Feature already exists'}), 400
    feature = Feature(name=name)
    session.add(feature)
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/features/<int:feature_id>', methods=['PUT'])
@cross_origin()
def edit_feature(feature_id):
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    feature = session.query(Feature).filter_by(id=feature_id).first()
    if not feature:
        session.close()
        return jsonify({'error': 'Feature not found'}), 404
    feature.name = name
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/features/<int:feature_id>', methods=['DELETE'])
@cross_origin()
def delete_feature(feature_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    feature = session.query(Feature).filter_by(id=feature_id).first()
    if not feature:
        session.close()
        return jsonify({'error': 'Feature not found'}), 404
    session.delete(feature)
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/compliance_tags', methods=['GET'])
@cross_origin()
def get_compliance_tags():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    tags = session.query(ComplianceTag).all()
    result = [{'id': t.id, 'name': t.name} for t in tags]
    session.close()
    return jsonify(result)

@app.route('/compliance_tags', methods=['POST'])
@cross_origin()
def add_compliance_tag():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    if session.query(ComplianceTag).filter_by(name=name).first():
        session.close()
        return jsonify({'error': 'Compliance tag already exists'}), 400
    tag = ComplianceTag(name=name)
    session.add(tag)
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/compliance_tags/<int:tag_id>', methods=['PUT'])
@cross_origin()
def edit_compliance_tag(tag_id):
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    tag = session.query(ComplianceTag).filter_by(id=tag_id).first()
    if not tag:
        session.close()
        return jsonify({'error': 'Compliance tag not found'}), 404
    tag.name = name
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/compliance_tags/<int:tag_id>', methods=['DELETE'])
@cross_origin()
def delete_compliance_tag(tag_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    tag = session.query(ComplianceTag).filter_by(id=tag_id).first()
    if not tag:
        session.close()
        return jsonify({'error': 'Compliance tag not found'}), 404
    session.delete(tag)
    session.commit()
    session.close()
    return jsonify({'success': True})

@app.route('/supplier-products-by-material/<int:product_id>', methods=['GET'])
@cross_origin()
def get_suppliers_by_material(product_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        supplier_products = session.query(SupplierProduct).filter(
            SupplierProduct.product_id == product_id,
            SupplierProduct.is_active == True
        ).all()
        result = []
        for sp in supplier_products:
            supplier = session.query(Supplier).filter(Supplier.id == sp.supplier_id).first()
            result.append({
                'supplier_id': sp.supplier_id,
                'supplier_name': supplier.name if supplier else None,
                'supplier_email': supplier.email if supplier else None,
                'product_id': sp.product_id,
                'unit_price': sp.unit_price,
                'current_stock': sp.current_stock
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/materials', methods=['POST'])
@cross_origin()
def add_material():
    try:
        data = request.get_json()
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        # Required fields: name, category, cost, unit
        name = data.get('name')
        category = data.get('category')
        cost = data.get('cost', 0)
        unit = data.get('unit', 'units')
        sku = data.get('sku') or f"SKU-{str(abs(hash(name)))[-6:]}"
        reorder_level = data.get('reorder_level', 0)
        description = data.get('description', '')
        photo_url = data.get('photo_url', '')
        quantity = data.get('quantity', 0)  # <-- Add this line to get initial stock
        # Check for duplicate name
        existing = session.query(Product).filter_by(name=name).first()
        if existing:
            session.close()
            return jsonify({'error': 'Material already exists', 'id': existing.id}), 400
        material = Product(
            name=name,
            category=category,
            cost=cost,
            unit=unit,
            sku=sku,
            reorder_level=reorder_level,
            description=description,
            photo_url=photo_url,
            quantity=quantity  # <-- Set initial stock here
        )
        session.add(material)
        session.commit()
        result = {
            'id': material.id,
            'name': material.name,
            'category': material.category,
            'cost': material.cost,
            'unit': material.unit,
            'sku': material.sku,
            'reorder_level': material.reorder_level,
            'description': material.description,
            'photo_url': material.photo_url,
            'quantity': material.quantity  # <-- Return quantity in response
        }
        session.close()
        return jsonify(result), 201
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/supplier-request-quotes', methods=['POST'])
@cross_origin()
def create_supplier_request_quote():
    try:
        data = request.json
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        # Check if a quote already exists for this supplier and request
        existing = session.query(SupplierRequestQuote).filter_by(request_id=data['request_id'], supplier_id=data['supplier_id']).first()
        if existing:
            session.close()
            return jsonify({'success': False, 'error': 'Revision already sent'}), 400
        quote_number = f"SRQ-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        total_amount = sum(
            item.get('unit_price', 0) * item.get('quantity', 0)
            for item in data.get('items', [])
        )
        quote = SupplierRequestQuote(
            quote_number=quote_number,
            request_id=data['request_id'],
            supplier_id=data['supplier_id'],
            total_amount=total_amount,
            status=data.get('status', 'pending'),
            fulfillment_date=datetime.fromisoformat(data['fulfillment_date']) if data.get('fulfillment_date') else None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(quote)
        session.commit()
        quote_id = quote.id  # Access before closing session
        session.close()
        return jsonify({'success': True, 'id': quote_id, 'quote_number': quote_number})
    except Exception as e:
        import traceback
        session.rollback()
        session.close()
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

@app.route('/supplier-request-quotes/<int:quote_id>/status', methods=['PUT'])
@cross_origin()
def update_supplier_request_quote_status(quote_id):
    """Admin can agree to a supplier's quote (set status to 'agreed') or update status generically."""
    from datetime import datetime
    data = request.json
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Missing status'}), 400
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    quote = session.query(SupplierRequestQuote).filter_by(id=quote_id).first()
    if not quote:
        session.close()
        return jsonify({'error': 'Quote not found'}), 404
    try:
        quote.status = new_status
        if 'packed_date' in data:
            from datetime import datetime as dt
            quote.packed_date = dt.fromisoformat(data['packed_date'])
        if 'dispatched_date' in data:
            from datetime import datetime as dt
            quote.dispatched_date = dt.fromisoformat(data['dispatched_date'])
        # If this quote is being agreed, reject all other quotes for the same request
        if new_status == 'agreed':
            other_quotes = session.query(SupplierRequestQuote).filter(
                SupplierRequestQuote.request_id == quote.request_id,
                SupplierRequestQuote.id != quote.id,
                SupplierRequestQuote.status.notin_(['rejected', 'agreed'])
            ).all()
            for oq in other_quotes:
                oq.status = 'rejected'
                oq.updated_at = datetime.now()
        quote.updated_at = datetime.now()
        session.commit()
        supplier = session.query(Supplier).filter(Supplier.id == quote.supplier_id).first()
        result = {
            'id': quote.id,
            'supplier_id': quote.supplier_id,
            'supplier_name': supplier.name if supplier else None,
            'fulfillment_date': quote.fulfillment_date.isoformat() if quote.fulfillment_date else None,
            'total_amount': quote.total_amount,
            'status': str(quote.status),
            'packed_date': quote.packed_date.isoformat() if quote.packed_date else None,
            'dispatched_date': quote.dispatched_date.isoformat() if quote.dispatched_date else None
        }
        session.close()
        return jsonify({'success': True, 'quote': result})
    except Exception as e:
        import traceback
        session.rollback()
        session.close()
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# Update GET endpoint to always return status as string
@app.route('/supplier-request-quotes', methods=['GET'])
@cross_origin()
def get_supplier_request_quotes():
    try:
        request_id = request.args.get('request_id')
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        query = session.query(SupplierRequestQuote)
        if request_id:
            query = query.filter(SupplierRequestQuote.request_id == int(request_id))
        quotes = query.all()
        result = []
        for q in quotes:
            supplier = session.query(Supplier).filter(Supplier.id == q.supplier_id).first()
            result.append({
                'id': q.id,
                'request_id': q.request_id,  # <-- Add this line
                'supplier_id': q.supplier_id,
                'supplier_name': supplier.name if supplier else None,
                'fulfillment_date': q.fulfillment_date.isoformat() if q.fulfillment_date else None,
                'total_amount': q.total_amount,
                'status': str(q.status) if q.status else 'pending',
                'packed_date': q.packed_date.isoformat() if q.packed_date else None,
                'dispatched_date': q.dispatched_date.isoformat() if q.dispatched_date else None
            })
        session.close()
        return jsonify(result)
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# Supplier accepts their own quote (rejects all others for the same request)
@app.route('/supplier-request-quotes/<int:quote_id>/accept', methods=['POST'])
@cross_origin()
def supplier_accept_quote(quote_id):
    """Supplier accepts their own quote, which automatically rejects all other quotes for the same request"""
    from datetime import datetime
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        
        if not supplier_id:
            return jsonify({'error': 'Missing supplier_id'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Find the quote
        quote = session.query(SupplierRequestQuote).filter_by(id=quote_id).first()
        if not quote:
            session.close()
            return jsonify({'error': 'Quote not found'}), 404
        
        # Verify this quote belongs to the supplier
        if quote.supplier_id != supplier_id:
            session.close()
            return jsonify({'error': 'Unauthorized: Quote does not belong to this supplier'}), 403
        
        # Check if quote is in a state that can be accepted
        if quote.status not in ['pending', 'submitted']:
            session.close()
            return jsonify({'error': f'Quote cannot be accepted in current status: {quote.status}'}), 400
        
        # Update this quote to 'agreed'
        quote.status = 'agreed'
        quote.updated_at = datetime.now()
        
        # Reject all other quotes for the same request
        other_quotes = session.query(SupplierRequestQuote).filter(
            SupplierRequestQuote.request_id == quote.request_id,
            SupplierRequestQuote.id != quote.id,
            SupplierRequestQuote.status.notin_(['rejected', 'agreed'])
        ).all()
        
        for other_quote in other_quotes:
            other_quote.status = 'rejected'
            other_quote.updated_at = datetime.now()
        
        # Update the request status to confirmed
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == quote.request_id).first()
        if supplier_request:
            supplier_request.status = SupplierRequestStatus.confirmed
            supplier_request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'message': f'Quote accepted successfully. {len(other_quotes)} other quotes were rejected.',
            'quote_id': quote_id,
            'request_id': quote.request_id
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# Supplier fulfillment status updates
@app.route('/supplier-requests/<int:request_id>/fulfillment-status', methods=['PUT'])
@cross_origin()
def update_fulfillment_status(request_id):
    """Update fulfillment status for an accepted supplier request"""
    session = None
    try:
        data = request.json
        supplier_id = data.get('supplier_id')
        fulfillment_status = data.get('fulfillment_status')  # packing, dispatched, delivered
        
        if not supplier_id or not fulfillment_status:
            return jsonify({'error': 'Missing supplier_id or fulfillment_status'}), 400
        
        if fulfillment_status not in ['packing', 'dispatched', 'delivered']:
            return jsonify({'error': 'Invalid fulfillment_status. Must be packing, dispatched, or delivered'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get the supplier request
        supplier_request = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not supplier_request:
            session.close()
            return jsonify({'error': 'Request not found'}), 404
        
        # Check if this supplier is assigned to this request and has accepted it
        supplier_status = session.execute(
            text("SELECT supplier_status FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        ).fetchone()
        
        if not supplier_status:
            session.close()
            return jsonify({'error': 'Supplier not found for this request'}), 404
        
        if supplier_status.supplier_status != 'accepted':
            session.close()
            return jsonify({'error': 'Only accepted suppliers can update fulfillment status'}), 403
        
        # Update fulfillment status and timestamp
        current_time = datetime.now()
        if fulfillment_status == 'packing':
            session.execute(
                text("UPDATE supplier_request_suppliers SET fulfillment_status = :fulfillment_status, packing_timestamp = :timestamp WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': request_id, 'supplier_id': supplier_id, 'fulfillment_status': fulfillment_status, 'timestamp': current_time}
            )
        elif fulfillment_status == 'dispatched':
            session.execute(
                text("UPDATE supplier_request_suppliers SET fulfillment_status = :fulfillment_status, dispatched_timestamp = :timestamp WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': request_id, 'supplier_id': supplier_id, 'fulfillment_status': fulfillment_status, 'timestamp': current_time}
            )
        elif fulfillment_status == 'delivered':
            session.execute(
                text("UPDATE supplier_request_suppliers SET fulfillment_status = :fulfillment_status, delivered_timestamp = :timestamp WHERE request_id = :request_id AND supplier_id = :supplier_id"),
                {'request_id': request_id, 'supplier_id': supplier_id, 'fulfillment_status': fulfillment_status, 'timestamp': current_time}
            )
            # Update warehouse stock for each item in the request and log transaction
            items = session.query(SupplierRequestItem).filter(SupplierRequestItem.request_id == request_id).all()
            for item in items:
                # Update SupplierProduct stock (warehouse stock)
                supplier_product = session.query(SupplierProduct).filter_by(supplier_id=supplier_id, product_id=item.product_id).first()
                if supplier_product:
                    if supplier_product.current_stock is None:
                        supplier_product.current_stock = 0
                    supplier_product.current_stock += item.quantity or 0
                    supplier_product.updated_at = datetime.now()
                else:
                    # If not present, create a new SupplierProduct record
                    supplier_product = SupplierProduct(
                        supplier_id=supplier_id,
                        product_id=item.product_id,
                        current_stock=item.quantity or 0,
                        unit_price=item.unit_price,
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    session.add(supplier_product)
                # Log transaction for stock in
                from models import Transaction, TransactionType
                txn = Transaction(
                    product_id=item.product_id,
                    supplier_id=supplier_id,
                    quantity=item.quantity,
                    type=TransactionType.stock_in,
                    date=current_time,
                    note=f"Stock received from supplier (Request ID: {request_id}) at price {item.unit_price}"
                )
                session.add(txn)
        
        # Update the main request updated_at timestamp
        supplier_request.updated_at = datetime.now()
        
        session.commit()
        session.close()
        
        return jsonify({
            'success': True,
            'message': f'Fulfillment status updated to {fulfillment_status}'
        })
        
    except Exception as e:
        if session:
            session.rollback()
            session.close()
        return jsonify({'error': str(e)}), 500

# Get fulfillment status for a request
@app.route('/supplier-requests/<int:request_id>/fulfillment-status', methods=['GET'])
@cross_origin()
def get_fulfillment_status(request_id):
    """Get fulfillment status for all suppliers on a request"""
    session = None
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get all suppliers and their fulfillment statuses for this request
        supplier_statuses = session.execute(
            text("SELECT s.id, s.name, s.email, srs.supplier_status, srs.fulfillment_status, " +
                "srs.packing_timestamp, srs.dispatched_timestamp, srs.delivered_timestamp " +
                "FROM suppliers s " +
                "JOIN supplier_request_suppliers srs ON s.id = srs.supplier_id " +
                "WHERE srs.request_id = :request_id"),
            {'request_id': request_id}
        ).fetchall()
        
        result = [
            {
                'supplier_id': row.id,
                'supplier_name': row.name,
                'supplier_email': row.email,
                'supplier_status': row.supplier_status,
                'fulfillment_status': row.fulfillment_status,
                'packing_timestamp': row.packing_timestamp.isoformat() if row.packing_timestamp else None,
                'dispatched_timestamp': row.dispatched_timestamp.isoformat() if row.dispatched_timestamp else None,
                'delivered_timestamp': row.delivered_timestamp.isoformat() if row.delivered_timestamp else None
            }
            for row in supplier_statuses
        ]
        
        session.close()
        return jsonify(result)
        
    except Exception as e:
        if session:
            session.close()
        return jsonify({'error': str(e)}), 500

# PDF Invoice Download Endpoints
@app.route('/supplier-requests/<int:request_id>/download-invoice/<int:supplier_id>', methods=['GET'])
@cross_origin()
def download_invoice_pdf(request_id, supplier_id):
    """Download invoice PDF for a specific request and supplier"""
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get request data
        request_data = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not request_data:
            return jsonify({'error': 'Request not found'}), 404
        
        # Get supplier data
        supplier_data = session.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier_data:
            return jsonify({'error': 'Supplier not found'}), 404
        
        # Get fulfillment data for this supplier
        fulfillment_data = session.execute(
            text("SELECT fulfillment_status, packing_timestamp, dispatched_timestamp, delivered_timestamp FROM supplier_request_suppliers WHERE request_id = :request_id AND supplier_id = :supplier_id"),
            {'request_id': request_id, 'supplier_id': supplier_id}
        ).fetchone()
        
        if not fulfillment_data:
            return jsonify({'error': 'Fulfillment data not found'}), 404
        
        # Convert request data to dict
        request_dict = {
            'id': request_data.id,
            'request_number': request_data.request_number,
            'title': request_data.title,
            'description': request_data.description,
            'priority': request_data.priority,
            'status': request_data.status.value if hasattr(request_data.status, 'value') else request_data.status,
            'expected_delivery_date': request_data.expected_delivery_date.isoformat() if request_data.expected_delivery_date else None,
            'delivery_address': request_data.delivery_address,
            'total_amount': request_data.total_amount,
            'notes': request_data.notes,
            'created_at': request_data.created_at.isoformat() if request_data.created_at else None,
            'items': []
        }
        
        # Get request items
        items = session.query(SupplierRequestItem).filter(SupplierRequestItem.request_id == request_id).all()
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).first()
            request_dict['items'].append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else 'Unknown Product',
                'product_sku': product.sku if product else 'N/A',
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total_price': item.quantity * item.unit_price,
                'specifications': item.specifications,
                'notes': item.notes
            })
        
        # Convert supplier data to dict
        supplier_dict = {
            'id': supplier_data.id,
            'name': supplier_data.name,
            'email': supplier_data.email,
            'status': 'accepted'  # Default status for invoice generation
        }
        
        # Convert fulfillment data to dict
        fulfillment_dict = {
            'fulfillment_status': fulfillment_data.fulfillment_status,
            'packing_timestamp': fulfillment_data.packing_timestamp.isoformat() if fulfillment_data.packing_timestamp else None,
            'dispatched_timestamp': fulfillment_data.dispatched_timestamp.isoformat() if fulfillment_data.dispatched_timestamp else None,
            'delivered_timestamp': fulfillment_data.delivered_timestamp.isoformat() if fulfillment_data.delivered_timestamp else None,
            'created_at': request_data.created_at.isoformat() if request_data.created_at else None
        }
        
        session.close()
        
        # Calculate shipping cost and taxes for this supplier
        subtotal = request_dict.get('total_amount', 0)
        # Determine product category from items (use first item's category or default)
        product_category = None
        if request_dict.get('items'):
            # You can enhance this by adding product category to your product model
            product_category = "machinery"  # Default category
        
        shipping_info = calculate_supplier_shipping_cost(
            supplier_id, 
            request_dict.get('delivery_address'),
            subtotal,
            product_category
        )
        
        # Generate PDF
        pdf_generator = InvoicePDFGenerator()
        invoice_number = f"INV-{request_id:04d}-{supplier_id:04d}-{datetime.now().strftime('%Y%m%d')}"
        pdf_buffer = pdf_generator.create_invoice_pdf(request_dict, supplier_dict, fulfillment_dict, invoice_number, shipping_info)
        
        # Return PDF as response
        from flask import send_file
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f"invoice_{request_data.request_number}_{supplier_data.name}_{datetime.now().strftime('%Y%m%d')}.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        import traceback
        logging.error(f"Error in download_invoice_pdf: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/supplier-requests/<int:request_id>/download-invoice', methods=['GET'])
@cross_origin()
def download_invoice_pdf_admin(request_id):
    """Download invoice PDF for admin (for the accepted supplier)"""
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get request data
        request_data = session.query(SupplierRequest).filter(SupplierRequest.id == request_id).first()
        if not request_data:
            return jsonify({'error': 'Request not found'}), 404
        
        # Find the accepted supplier
        accepted_supplier = session.execute(
            text("SELECT s.id, s.name, s.email, srs.fulfillment_status, srs.packing_timestamp, srs.dispatched_timestamp, srs.delivered_timestamp FROM suppliers s " +
            "JOIN supplier_request_suppliers srs ON s.id = srs.supplier_id " +
            "WHERE srs.request_id = :request_id AND srs.supplier_status = 'accepted'"),
            {'request_id': request_id}
        ).fetchone()
        
        if not accepted_supplier:
            return jsonify({'error': 'No accepted supplier found for this request'}), 404
        
        # Convert request data to dict
        request_dict = {
            'id': request_data.id,
            'request_number': request_data.request_number,
            'title': request_data.title,
            'description': request_data.description,
            'priority': request_data.priority,
            'status': request_data.status.value if hasattr(request_data.status, 'value') else request_data.status,
            'expected_delivery_date': request_data.expected_delivery_date.isoformat() if request_data.expected_delivery_date else None,
            'delivery_address': request_data.delivery_address,
            'total_amount': request_data.total_amount,
            'notes': request_data.notes,
            'created_at': request_data.created_at.isoformat() if request_data.created_at else None,
            'items': []
        }
        
        # Get request items
        items = session.query(SupplierRequestItem).filter(SupplierRequestItem.request_id == request_id).all()
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).first()
            request_dict['items'].append({
                'id': item.id,
                'product_id': item.product_id,
                'product_name': product.name if product else 'Unknown Product',
                'product_sku': product.sku if product else 'N/A',
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total_price': item.quantity * item.unit_price,
                'specifications': item.specifications,
                'notes': item.notes
            })
        
        # Convert supplier data to dict
        supplier_dict = {
            'id': accepted_supplier.id,
            'name': accepted_supplier.name,
            'email': accepted_supplier.email,
            'status': 'accepted'
        }
        
        # Convert fulfillment data to dict
        fulfillment_dict = {
            'fulfillment_status': accepted_supplier.fulfillment_status,
            'packing_timestamp': accepted_supplier.packing_timestamp.isoformat() if accepted_supplier.packing_timestamp else None,
            'dispatched_timestamp': accepted_supplier.dispatched_timestamp.isoformat() if accepted_supplier.dispatched_timestamp else None,
            'delivered_timestamp': accepted_supplier.delivered_timestamp.isoformat() if accepted_supplier.delivered_timestamp else None,
            'created_at': request_data.created_at.isoformat() if request_data.created_at else None
        }
        
        session.close()
        
        # Calculate shipping cost and taxes for the accepted supplier
        subtotal = request_dict.get('total_amount', 0)
        # Determine product category from items (use first item's category or default)
        product_category = None
        if request_dict.get('items'):
            # You can enhance this by adding product category to your product model
            product_category = "machinery"  # Default category
        
        shipping_info = calculate_supplier_shipping_cost(
            accepted_supplier.id, 
            request_dict.get('delivery_address'),
            subtotal,
            product_category
        )
        
        # Generate PDF
        pdf_generator = InvoicePDFGenerator()
        invoice_number = f"INV-{request_id:04d}-{accepted_supplier.id:04d}-{datetime.now().strftime('%Y%m%d')}"
        pdf_buffer = pdf_generator.create_invoice_pdf(request_dict, supplier_dict, fulfillment_dict, invoice_number, shipping_info)
        
        # Return PDF as response
        from flask import send_file
        return send_file(
            pdf_buffer,
            as_attachment=True,
            download_name=f"invoice_{request_data.request_number}_{accepted_supplier.name}_{datetime.now().strftime('%Y%m%d')}.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        import traceback
        logging.error(f"Error in download_invoice_pdf_admin: {e}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

# Application Tags Management
@app.route('/application-tags', methods=['GET'])
@cross_origin()
def get_application_tags():
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Get application tags from the dedicated table
        application_tags = session.query(ApplicationTag).order_by(ApplicationTag.name).all()
        result = [{'id': tag.id, 'name': tag.name} for tag in application_tags]
        session.close()
        return jsonify(result)
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/application-tags', methods=['POST'])
@cross_origin()
def add_application_tag():
    try:
        data = request.json
        tag_name = data.get('name', '').strip()
        
        if not tag_name:
            return jsonify({'error': 'Tag name is required'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Check if tag already exists
        existing_tag = session.query(ApplicationTag).filter_by(name=tag_name).first()
        if existing_tag:
            session.close()
            return jsonify({'error': 'Application tag already exists'}), 400
        
        # Create new application tag
        new_tag = ApplicationTag(name=tag_name)
        session.add(new_tag)
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': 'Application tag added successfully'})
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/application-tags/<int:tag_id>', methods=['PUT'])
@cross_origin()
def edit_application_tag(tag_id):
    try:
        data = request.json
        new_name = data.get('name', '').strip()
        
        if not new_name:
            return jsonify({'error': 'Tag name is required'}), 400
        
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Find the application tag
        tag = session.query(ApplicationTag).filter_by(id=tag_id).first()
        if not tag:
            session.close()
            return jsonify({'error': 'Application tag not found'}), 404
        
        # Check if new name already exists
        existing_tag = session.query(ApplicationTag).filter_by(name=new_name).first()
        if existing_tag and existing_tag.id != tag_id:
            session.close()
            return jsonify({'error': 'Application tag name already exists'}), 400
        
        # Update the tag name
        tag.name = new_name
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': 'Application tag updated successfully'})
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

@app.route('/application-tags/<int:tag_id>', methods=['DELETE'])
@cross_origin()
def delete_application_tag(tag_id):
    try:
        engine = get_engine()
        Session = sessionmaker(bind=engine)
        session = Session()
        
        # Find the application tag
        tag = session.query(ApplicationTag).filter_by(id=tag_id).first()
        if not tag:
            session.close()
            return jsonify({'error': 'Application tag not found'}), 404
        
        # Delete the tag
        session.delete(tag)
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': 'Application tag deleted successfully'})
    except Exception as e:
        session.close()
        return jsonify({'error': str(e)}), 500

# --- Customer-Admin Negotiation Endpoints ---
from sqlalchemy import text

@app.route('/customer_requests/<int:req_id>/customer-offer', methods=['POST'])
@cross_origin()
def customer_propose_offer(req_id):
    """Customer proposes a counter-offer for a quoted request"""
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        offer = CustomerNegotiation(
            request_id=req_id,
            customer_id=data.get('customer_id'),
            offer_type='customer_offer',
            total_amount=data.get('total_amount'),
            notes=data.get('notes', ''),
            status='pending'
        )
        session.add(offer)
        session.flush()
        for item in data.get('items', []):
            offer_item = CustomerNegotiationItem(
                negotiation_id=offer.id,
                product_id=item.get('product_id'),
                quantity=item.get('quantity'),
                unit_price=item.get('unit_price'),
                total_price=item.get('total_price'),
                specifications=item.get('specifications', ''),
                notes=item.get('notes', '')
            )
            session.add(offer_item)
        req.status = CustomerRequestStatus.manager_review.value
        req.updated_at = datetime.now()
        session.commit()
        session.close()
        return jsonify({'success': True})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/customer_requests/<int:req_id>/admin-respond-offer', methods=['POST'])
@cross_origin()
def admin_respond_to_customer_offer(req_id):
    """Admin responds to a customer's offer: accept, reject, or counter"""
    data = request.json
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    req = session.query(CustomerRequest).filter_by(id=req_id).first()
    if not req:
        session.close()
        return jsonify({'error': 'Request not found'}), 404
    try:
        negotiation_id = data.get('negotiation_id')
        action = data.get('action')  # 'accept', 'reject', 'counter'
        counter_offer = data.get('counter_offer', {})
        notes = data.get('notes', '')
        negotiation = session.query(CustomerNegotiation).filter_by(id=negotiation_id, request_id=req_id).first()
        if not negotiation:
            session.close()
            return jsonify({'error': 'Negotiation not found'}), 404
        if action == 'accept':
            negotiation.status = 'accepted'
            req.status = CustomerRequestStatus.customer_accepted.value
            req.quoted_price = negotiation.total_amount
            req.updated_at = datetime.now()
            message = 'Offer accepted.'
        elif action == 'reject':
            negotiation.status = 'rejected'
            req.status = CustomerRequestStatus.customer_declined.value
            req.updated_at = datetime.now()
            message = 'Offer rejected.'
        elif action == 'counter':
            negotiation.status = 'rejected'
            counter_negotiation = CustomerNegotiation(
                request_id=req_id,
                customer_id=negotiation.customer_id,
                offer_type='admin_counter',
                total_amount=counter_offer.get('total_amount'),
                notes=notes,
                status='pending'
            )
            session.add(counter_negotiation)
            session.flush()
            for item in counter_offer.get('items', []):
                counter_item = CustomerNegotiationItem(
                    negotiation_id=counter_negotiation.id,
                    product_id=item.get('product_id'),
                    quantity=item.get('quantity'),
                    unit_price=item.get('unit_price'),
                    total_price=item.get('total_price'),
                    specifications=item.get('specifications', ''),
                    notes=item.get('notes', '')
                )
                session.add(counter_item)
            req.status = CustomerRequestStatus.quoted.value
            req.quoted_price = counter_offer.get('total_amount')
            req.updated_at = datetime.now()
            message = 'Counter-offer sent.'
        session.commit()
        session.close()
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({'error': str(e)}), 400

@app.route('/customer_requests/<int:req_id>/negotiations', methods=['GET'])
@cross_origin()
def get_customer_negotiation_history(req_id):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    negotiations = session.query(CustomerNegotiation).filter_by(request_id=req_id).order_by(CustomerNegotiation.created_at.asc()).all()
    data = []
    for n in negotiations:
        items = [
            {
                'product_id': i.product_id,
                'quantity': i.quantity,
                'unit_price': i.unit_price,
                'total_price': i.total_price,
                'specifications': i.specifications,
                'notes': i.notes
            }
            for i in n.items
        ]
        data.append({
            'id': n.id,
            'offer_type': n.offer_type,
            'total_amount': n.total_amount,
            'notes': n.notes,
            'status': n.status,
            'created_at': n.created_at,
            'items': items
        })
    session.close()
    return jsonify({'negotiations': data})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) 