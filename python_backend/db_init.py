from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from python_backend.models import Base, User, UserRole, Product, Customer, Warehouse, Employee, Project, ProjectRequirement, ProjectStatus, Requisition, RequisitionStatus, Supplier, Transaction, Skill, FinishedProduct, FinishedProductSkill, FinishedProductMaterial, ProjectTask, ProjectTaskDependency, ProjectTaskMaterial, CompanyHoliday, Order, ApplicationTag
except ImportError:
    from models import Base, User, UserRole, Product, Customer, Warehouse, Employee, Project, ProjectRequirement, ProjectStatus, Requisition, RequisitionStatus, Supplier, Transaction, Skill, FinishedProduct, FinishedProductSkill, FinishedProductMaterial, ProjectTask, ProjectTaskDependency, ProjectTaskMaterial, CompanyHoliday, Order, ApplicationTag
import bcrypt
from datetime import datetime, timedelta
import json

MYSQL_USER = 'root'
MYSQL_PASSWORD = 'newpassword'
MYSQL_HOST = 'localhost'
MYSQL_DB = 'stock_db'

DATABASE_URL = f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}'

def get_engine():
    return create_engine(DATABASE_URL, echo=True)

def create_tables():
    engine = get_engine()
    with engine.connect() as connection:
        connection.execute(text("SET FOREIGN_KEY_CHECKS=0;"))
        connection.execute(text("DROP TABLE IF EXISTS project_order_items;"))
        connection.execute(text("DROP TABLE IF EXISTS employee_performance;"))
        connection.execute(text("DROP TABLE IF EXISTS location_stock;"))
        # --- Migration: Add new columns individually ---
        product_columns = [
            ("base_price", "FLOAT"),
            ("procurement_cost", "FLOAT"),
            ("min_load_kw", "INT"),
            ("max_load_kw", "INT"),
            ("voltage_rating", "INT"),
            ("phase_type", "VARCHAR(20)"),
            ("application_tags", "TEXT"),
            ("compliance_tags", "TEXT"),
            ("features", "TEXT"),
            ("mount_type", "VARCHAR(20)"),
            ("lead_time_days", "INT"),
            ("delivery_fee", "FLOAT"),
            ("customization_fee", "FLOAT"),
            ("installation_fee", "FLOAT"),
            ("warranty_note", "TEXT"),
            ("image_url", "TEXT")
        ]
        for col, coltype in product_columns:
            try:
                connection.execute(text(f"ALTER TABLE products ADD COLUMN {col} {coltype}"))
            except Exception:
                pass  # Ignore if column exists
        # Add new columns to finished_products
        finished_product_columns = [
            ("phase_type", "VARCHAR(20)"),
            ("mount_type", "VARCHAR(20)"),
            ("compliance_tags", "TEXT"),
            ("features", "TEXT"),
            ("application_tags", "TEXT"),
            ("voltage_rating", "INT"),
            ("min_load_kw", "INT"),
            ("max_load_kw", "INT"),
            ("estimated_hours", "FLOAT")
        ]
        for col, coltype in finished_product_columns:
            try:
                connection.execute(text(f"ALTER TABLE finished_products ADD COLUMN {col} {coltype}"))
            except Exception:
                pass  # Ignore if column exists
        # Orders table
        try:
            connection.execute(text("ALTER TABLE orders ADD COLUMN profit_amount FLOAT"))
        except Exception:
            pass
        # RequirementsHistory table
        connection.execute(text("""
        CREATE TABLE IF NOT EXISTS requirements_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT,
            input_json TEXT,
            matched_product_id INT,
            accepted BOOLEAN,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (matched_product_id) REFERENCES products(id)
        );
        """))
        # Create features and compliance_tags tables if not exist
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS features (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL
        );
        '''))
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS compliance_tags (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL
        );
        '''))
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS application_tags (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
        '''))
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS product_features (
            product_id INT,
            feature_id INT,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (feature_id) REFERENCES features(id)
        );
        '''))
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS product_compliance_tags (
            product_id INT,
            compliance_tag_id INT,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (compliance_tag_id) REFERENCES compliance_tags(id)
        );
        '''))
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS finished_product_features (
            finished_product_id INT,
            feature_id INT,
            FOREIGN KEY (finished_product_id) REFERENCES finished_products(id),
            FOREIGN KEY (feature_id) REFERENCES features(id)
        );
        '''))
        connection.execute(text('''
        CREATE TABLE IF NOT EXISTS finished_product_compliance_tags (
            finished_product_id INT,
            compliance_tag_id INT,
            FOREIGN KEY (finished_product_id) REFERENCES finished_products(id),
            FOREIGN KEY (compliance_tag_id) REFERENCES compliance_tags(id)
        );
        '''))
        Base.metadata.drop_all(engine)
        connection.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
        connection.commit()
    Base.metadata.create_all(engine)

def seed_data():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Create admin user
    if not session.query(User).filter_by(username='admin').first():
        password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = User(username='admin', email='admin@example.com', password_hash=password_hash, role=UserRole.admin)
        session.add(admin)
    
    # Create project manager user
    if not session.query(User).filter_by(username='pm1').first():
        password_hash = bcrypt.hashpw('pm123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        pm = User(username='pm1', email='pm1@example.com', password_hash=password_hash, role=UserRole.project_manager)
        session.add(pm)
    
    # Remove old employees and their users for a clean test
    session.query(Employee).delete()
    session.query(User).filter(User.role == UserRole.employee).delete()
    session.commit()

    # Create employee users
    password_hash = bcrypt.hashpw('emp123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    emp1 = User(username='emp1', email='emp1@example.com', password_hash=password_hash, role=UserRole.employee)
    emp2 = User(username='emp2', email='emp2@example.com', password_hash=password_hash, role=UserRole.employee)
    emp3 = User(username='emp3', email='emp3@example.com', password_hash=password_hash, role=UserRole.employee)
    session.add_all([emp1, emp2, emp3])
    session.commit()

    # Employee 1: matches project location
    emp1_user = session.query(User).filter_by(username='emp1').first()
    employee1 = Employee(
        user_id=emp1_user.id,
        first_name='John',
        last_name='Doe',
        email='john.doe@company.com',
        phone='+1234567890',
        skills=json.dumps(['Python', 'React', 'Database Design', 'Project Management']),
        hourly_rate=25.0,
        efficiency_rating=1.2,
        max_workload=40.0,
        current_workload=0.0,
        location='Main Office Building',
        is_available=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    session.add(employee1)

    # Employee 2: different location
    emp2_user = session.query(User).filter_by(username='emp2').first()
    employee2 = Employee(
        user_id=emp2_user.id,
        first_name='Jane',
        last_name='Smith',
        email='jane.smith@company.com',
        phone='+1234567891',
        skills=json.dumps(['JavaScript', 'UI/UX Design', 'Agile', 'Testing']),
        hourly_rate=30.0,
        efficiency_rating=1.5,
        max_workload=40.0,
        current_workload=0.0,
        location='San Francisco',
        is_available=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    session.add(employee2)

    # Employee 3: different location
    emp3_user = session.query(User).filter_by(username='emp3').first()
    employee3 = Employee(
        user_id=emp3_user.id,
        first_name='Alice',
        last_name='Johnson',
        email='alice.johnson@company.com',
        phone='+1234567892',
        skills=json.dumps(['C++', 'Embedded Systems', 'Automation']),
        hourly_rate=28.0,
        efficiency_rating=1.3,
        max_workload=40.0,
        current_workload=0.0,
        location='Chicago',
        is_available=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    session.add(employee3)
    session.commit()
    
    # Seed application tags
    application_tags = [
        'Power Distribution',
        'Industrial',
        'Heavy Industry',
        'Power Transmission',
        'Automation',
        'Process Control',
        'Energy Monitoring',
        'Data Logging',
        'Smart Grid',
        'Power Quality',
        'Solar Power',
        'Renewable',
        'Power Backup',
        'Critical Loads',
        'Generator Synchronization',
        'DG-Solar Switching',
        'Load Sharing'
    ]
    
    for tag_name in application_tags:
        if not session.query(ApplicationTag).filter_by(name=tag_name).first():
            tag = ApplicationTag(name=tag_name)
            session.add(tag)
    
    session.commit()
    
    # Add sample products if not exists (MASTER MATERIALS ONLY)
    if not session.query(Product).filter_by(sku='ATS120').first():
        product = Product(
            name='Auto Transfer Switch Panel - 120kW',
            sku='ATS120',
            category='Control Panel',
            quantity=5,
            unit='pcs',
            cost=80000.0,
            base_price=95000.0,
            procurement_cost=80000.0,
            min_load_kw=100,
            max_load_kw=150,
            voltage_rating=415,
            phase_type='3-phase',
            application_tags=json.dumps(['DG-Solar Switching', 'Load Sharing']),
            compliance_tags=json.dumps(['IS-8623', 'IEC-61439']),
            features=json.dumps(['Remote monitoring', 'Harmonic filtering', 'Auto restart']),
            mount_type='Outdoor',
            lead_time_days=0,
            delivery_fee=1500.0,
            customization_fee=5000.0,
            installation_fee=10000.0,
            warranty_note='Includes 1-year warranty and on-site support',
            image_url='https://example.com/ats120.jpg',
            reorder_level=2,
            supplier_id=None,  # MASTER MATERIAL
            conversion_ratio=1.0
        )
        session.add(product)
        session.commit()
    # Add more master materials as needed
    if not session.query(Product).filter_by(sku='SKU001').first():
        product = Product(
            name='High-Performance Laptop',
            sku='SKU001',
            category='Electronics',
            quantity=50,
            unit='pcs',
            cost=1200.0,
            reorder_level=10,
            supplier_id=None,
            conversion_ratio=1.0
        )
        session.add(product)
        session.commit()
    if not session.query(Product).filter_by(sku='SKU002').first():
        product2 = Product(
            name='Office Chair',
            sku='SKU002',
            category='Furniture',
            quantity=25,
            unit='pcs',
            cost=150.0,
            reorder_level=5,
            supplier_id=None,
            conversion_ratio=1.0
        )
        session.add(product2)
        session.commit()
    if not session.query(Product).filter_by(sku='SKU003').first():
        product3 = Product(
            name='Software License',
            sku='SKU003',
            category='Software',
            quantity=100,
            unit='licenses',
            cost=50.0,
            reorder_level=20,
            supplier_id=None,
            conversion_ratio=1.0
        )
        session.add(product3)
        session.commit()
    
    # Add sample customer
    if not session.query(Customer).filter_by(name='Sample Customer').first():
        customer = Customer(
            name='Sample Customer',
            email='customer@example.com',
            phone='+1234567890',
            address='123 Main St, City, State',
            company='Sample Company',
            tax_id='TAX123456',
            credit_limit=1000.0
        )
        session.add(customer)
    
    # Add sample warehouses
    if session.query(Warehouse).count() == 0:
        session.add(Warehouse(name='Main Warehouse', location='Building A'))
        session.add(Warehouse(name='Secondary Warehouse', location='Building B'))
        session.add(Warehouse(name='Cold Storage', location='Building C'))
    
    # Fetch products by SKU to get their real IDs
    product1 = session.query(Product).filter_by(sku='SKU001').first()
    product2 = session.query(Product).filter_by(sku='SKU002').first()
    # Seed sample requisitions
    session.query(Requisition).delete()
    session.commit()
    reqs = [
        Requisition(product_id=product1.id, requested_by='Assembly', quantity=10, priority='high', timestamp=datetime.now() - timedelta(hours=5), status=RequisitionStatus.pending.value),
        Requisition(product_id=product1.id, requested_by='Maintenance', quantity=15, priority='medium', timestamp=datetime.now() - timedelta(hours=3), status=RequisitionStatus.pending.value),
        Requisition(product_id=product2.id, requested_by='Stores', quantity=5, priority='critical', timestamp=datetime.now() - timedelta(hours=2), status=RequisitionStatus.pending.value),
        Requisition(product_id=product1.id, requested_by='Stores', quantity=8, priority='low', timestamp=datetime.now() - timedelta(hours=1), status=RequisitionStatus.pending.value),
    ]
    session.add_all(reqs)
    session.commit()

    # Ensure at least 2 suppliers and 2 products exist
    suppliers = session.query(Supplier).all()
    if len(suppliers) < 2:
        s1 = Supplier(name='Demo Supplier A', email='a@example.com', phone='123', address='Addr A', company='DemoCo', tax_id='TAXA', created_at=datetime.now(), updated_at=datetime.now())
        s2 = Supplier(name='Demo Supplier B', email='b@example.com', phone='456', address='Addr B', company='DemoCo', tax_id='TAXB', created_at=datetime.now(), updated_at=datetime.now())
        session.add_all([s1, s2])
        session.commit()
        suppliers = session.query(Supplier).all()
    products = session.query(Product).all()
    if len(products) < 2:
        p1 = Product(name='Demo Product X', sku='SKU-X', category='Cat', quantity=100, unit='pcs', cost=50, reorder_level=10, supplier_id=suppliers[0].id)
        p2 = Product(name='Demo Product Y', sku='SKU-Y', category='Cat', quantity=200, unit='pcs', cost=30, reorder_level=20, supplier_id=suppliers[1].id)
        session.add_all([p1, p2])
        session.commit()
        products = session.query(Product).all()
    # Seed at least 2 stock_in transactions for each supplier
    session.query(Transaction).filter(Transaction.type=='stock_in').delete()
    session.commit()
    from random import randint, uniform
    for s in suppliers:
        for i in range(2):
            product = products[i % len(products)]
            qty = randint(50, 150)
            cost = product.cost
            lead_time = randint(3, 8)
            rejected = randint(0, 5)
            t = Transaction(
                type='stock_in',
                product_id=product.id,
                quantity=qty,
                location='Main Warehouse',
                date=datetime.now(),
                user_id=1,
                note=f'lead_time={lead_time} rejected={rejected}',
                supplier_id=s.id
            )
            session.add(t)
    session.commit()

    # Create customer user
    if not session.query(User).filter_by(username='customer1').first():
        password_hash = bcrypt.hashpw('custpass'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        customer_user = User(username='customer1', email='customer1@example.com', password_hash=password_hash, role=UserRole.customer)
        session.add(customer_user)

    # Create supplier user
    if not session.query(User).filter_by(username='supplier1').first():
        password_hash = bcrypt.hashpw('supppass'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        supplier_user = User(username='supplier1', email='supplier1@example.com', password_hash=password_hash, role=UserRole.supplier)
        session.add(supplier_user)

    # Add sample skills
    sample_skills = ['Assembly', 'Testing', 'Quality Control', 'Packaging', 'Electronics Repair', 'Software Installation']
    for skill_name in sample_skills:
        if not session.query(Skill).filter_by(name=skill_name).first():
            skill = Skill(name=skill_name)
            session.add(skill)
    session.commit()

    # Add sample finished product if not exists
    if not session.query(FinishedProduct).filter_by(model_name='Sample Product').first():
        # Get a sample product as material
        sample_product = session.query(Product).first()
        if sample_product:
            finished_product = FinishedProduct(
                model_name='Sample Product',
                total_cost=800.0,
                materials_json=json.dumps([{
                    'material_id': sample_product.id,
                    'name': sample_product.name,
                    'quantity': 1
                }])
            )
            session.add(finished_product)
            session.commit()

            # Add skill relationship
            sample_skill = session.query(Skill).filter_by(name='Assembly').first()
            if sample_skill:
                fp_skill = FinishedProductSkill(
                    finished_product_id=finished_product.id,
                    skill_id=sample_skill.id
                )
                session.add(fp_skill)

            # Add material relationship
            fp_material = FinishedProductMaterial(
                finished_product_id=finished_product.id,
                material_id=sample_product.id,
                quantity=1.0
            )
            session.add(fp_material)
            session.commit()

    # --- POWER MANAGEMENT CONTROLS MATERIALS ---
    power_products = [
        {
            'name': 'LT Panel (PCC)',
            'sku': 'PWR-LT-PCC-001',
            'category': 'Power Distribution',
            'quantity': 10,
            'unit': 'pcs',
            'cost': 120000.0,
            'base_price': 145000.0,
            'procurement_cost': 120000.0,
            'min_load_kw': 50,
            'max_load_kw': 500,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Power Distribution', 'Industrial'],
            'compliance_tags': ['IS-8623', 'IEC-61439'],
            'features': ['Drawout feeders', 'Remote monitoring', 'Energy metering'],
            'mount_type': 'Indoor',
            'lead_time_days': 7,
            'delivery_fee': 2000.0,
            'customization_fee': 8000.0,
            'installation_fee': 12000.0,
            'warranty_note': '2 years on-site warranty',
            'image_url': 'https://example.com/pcc_panel.jpg',
            'reorder_level': 2,
        },
        {
            'name': 'HT Panel (MCC)',
            'sku': 'PWR-HT-MCC-002',
            'category': 'Power Distribution',
            'quantity': 6,
            'unit': 'pcs',
            'cost': 250000.0,
            'base_price': 295000.0,
            'procurement_cost': 250000.0,
            'min_load_kw': 200,
            'max_load_kw': 2000,
            'voltage_rating': 11000,
            'phase_type': '3-phase',
            'application_tags': ['Power Distribution', 'Heavy Industry'],
            'compliance_tags': ['IS-3427', 'IEC-62271'],
            'features': ['Motor protection', 'SCADA integration'],
            'mount_type': 'Indoor',
            'lead_time_days': 14,
            'delivery_fee': 3500.0,
            'customization_fee': 12000.0,
            'installation_fee': 20000.0,
            'warranty_note': '3 years warranty',
            'image_url': 'https://example.com/mcc_panel.jpg',
            'reorder_level': 1,
        },
        {
            'name': 'Bus Duct',
            'sku': 'PWR-BUSDUCT-003',
            'category': 'Bus Ducts & Cable Trays',
            'quantity': 100,
            'unit': 'meters',
            'cost': 1800.0,
            'base_price': 2200.0,
            'procurement_cost': 1800.0,
            'min_load_kw': 50,
            'max_load_kw': 2000,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Power Transmission'],
            'compliance_tags': ['IS-8623'],
            'features': ['Sandwich type', 'Copper conductor'],
            'mount_type': 'Indoor',
            'lead_time_days': 5,
            'delivery_fee': 500.0,
            'customization_fee': 2000.0,
            'installation_fee': 3000.0,
            'warranty_note': '1 year warranty',
            'image_url': 'https://example.com/busduct.jpg',
            'reorder_level': 20,
        },
        {
            'name': 'Industrial PLC Panel',
            'sku': 'PWR-PLC-004',
            'category': 'Automation',
            'quantity': 8,
            'unit': 'pcs',
            'cost': 95000.0,
            'base_price': 115000.0,
            'procurement_cost': 95000.0,
            'min_load_kw': 1,
            'max_load_kw': 50,
            'voltage_rating': 230,
            'phase_type': 'Single',
            'application_tags': ['Automation', 'Process Control'],
            'compliance_tags': ['IEC-61131'],
            'features': ['Programmable', 'Remote diagnostics'],
            'mount_type': 'Indoor',
            'lead_time_days': 10,
            'delivery_fee': 1200.0,
            'customization_fee': 4000.0,
            'installation_fee': 6000.0,
            'warranty_note': '18 months warranty',
            'image_url': 'https://example.com/plc_panel.jpg',
            'reorder_level': 2,
        },
        {
            'name': 'Energy Monitoring System',
            'sku': 'PWR-EMS-005',
            'category': 'Energy Monitoring',
            'quantity': 15,
            'unit': 'pcs',
            'cost': 35000.0,
            'base_price': 42000.0,
            'procurement_cost': 35000.0,
            'min_load_kw': 1,
            'max_load_kw': 1000,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Energy Monitoring', 'Data Logging'],
            'compliance_tags': ['IEC-62053'],
            'features': ['Web dashboard', 'Multi-channel'],
            'mount_type': 'Indoor',
            'lead_time_days': 4,
            'delivery_fee': 800.0,
            'customization_fee': 2000.0,
            'installation_fee': 2500.0,
            'warranty_note': '1 year warranty',
            'image_url': 'https://example.com/ems.jpg',
            'reorder_level': 3,
        },
        {
            'name': 'Smart Meter',
            'sku': 'PWR-SMTR-006',
            'category': 'Energy Monitoring',
            'quantity': 30,
            'unit': 'pcs',
            'cost': 9000.0,
            'base_price': 11000.0,
            'procurement_cost': 9000.0,
            'min_load_kw': 0,
            'max_load_kw': 100,
            'voltage_rating': 230,
            'phase_type': 'Single',
            'application_tags': ['Energy Monitoring', 'Smart Grid'],
            'compliance_tags': ['IS-13779'],
            'features': ['Remote reading', 'Tamper detection'],
            'mount_type': 'Indoor',
            'lead_time_days': 3,
            'delivery_fee': 300.0,
            'customization_fee': 1000.0,
            'installation_fee': 1200.0,
            'warranty_note': '2 years warranty',
            'image_url': 'https://example.com/smart_meter.jpg',
            'reorder_level': 5,
        },
        {
            'name': 'Power Factor Correction Unit',
            'sku': 'PWR-PFCU-007',
            'category': 'Power Quality',
            'quantity': 12,
            'unit': 'pcs',
            'cost': 40000.0,
            'base_price': 48000.0,
            'procurement_cost': 40000.0,
            'min_load_kw': 10,
            'max_load_kw': 500,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Power Quality', 'Industrial'],
            'compliance_tags': ['IS-13340'],
            'features': ['Automatic switching', 'Thyristor based'],
            'mount_type': 'Indoor',
            'lead_time_days': 6,
            'delivery_fee': 1000.0,
            'customization_fee': 2500.0,
            'installation_fee': 3500.0,
            'warranty_note': '2 years warranty',
            'image_url': 'https://example.com/pfcu.jpg',
            'reorder_level': 2,
        },
        {
            'name': 'Dry Type Transformer',
            'sku': 'PWR-TRFMR-008',
            'category': 'Transformers',
            'quantity': 4,
            'unit': 'pcs',
            'cost': 350000.0,
            'base_price': 410000.0,
            'procurement_cost': 350000.0,
            'min_load_kw': 100,
            'max_load_kw': 2500,
            'voltage_rating': 11000,
            'phase_type': '3-phase',
            'application_tags': ['Power Distribution', 'Industrial'],
            'compliance_tags': ['IS-11171'],
            'features': ['Low loss', 'Self-cooled'],
            'mount_type': 'Indoor',
            'lead_time_days': 20,
            'delivery_fee': 8000.0,
            'customization_fee': 20000.0,
            'installation_fee': 25000.0,
            'warranty_note': '5 years warranty',
            'image_url': 'https://example.com/transformer.jpg',
            'reorder_level': 1,
        },
        {
            'name': 'Solar Inverter Panel',
            'sku': 'PWR-SOLAR-009',
            'category': 'Solar Power',
            'quantity': 10,
            'unit': 'pcs',
            'cost': 60000.0,
            'base_price': 72000.0,
            'procurement_cost': 60000.0,
            'min_load_kw': 5,
            'max_load_kw': 100,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Solar Power', 'Renewable'],
            'compliance_tags': ['IEC-62109'],
            'features': ['MPPT', 'Remote monitoring'],
            'mount_type': 'Outdoor',
            'lead_time_days': 8,
            'delivery_fee': 1500.0,
            'customization_fee': 3000.0,
            'installation_fee': 5000.0,
            'warranty_note': '3 years warranty',
            'image_url': 'https://example.com/solar_inverter.jpg',
            'reorder_level': 2,
        },
        {
            'name': 'UPS System',
            'sku': 'PWR-UPS-010',
            'category': 'Power Backup',
            'quantity': 7,
            'unit': 'pcs',
            'cost': 85000.0,
            'base_price': 99000.0,
            'procurement_cost': 85000.0,
            'min_load_kw': 5,
            'max_load_kw': 200,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Power Backup', 'Critical Loads'],
            'compliance_tags': ['IEC-62040'],
            'features': ['Online double conversion', 'Battery management'],
            'mount_type': 'Indoor',
            'lead_time_days': 6,
            'delivery_fee': 1200.0,
            'customization_fee': 4000.0,
            'installation_fee': 6000.0,
            'warranty_note': '2 years warranty',
            'image_url': 'https://example.com/ups.jpg',
            'reorder_level': 2,
        },
        {
            'name': 'DG Sync Panel',
            'sku': 'PWR-DGSYNC-011',
            'category': 'Power Backup',
            'quantity': 5,
            'unit': 'pcs',
            'cost': 130000.0,
            'base_price': 155000.0,
            'procurement_cost': 130000.0,
            'min_load_kw': 50,
            'max_load_kw': 1000,
            'voltage_rating': 415,
            'phase_type': '3-phase',
            'application_tags': ['Power Backup', 'Generator Synchronization'],
            'compliance_tags': ['IS-13947'],
            'features': ['Auto DG synchronizing', 'Load sharing'],
            'mount_type': 'Indoor',
            'lead_time_days': 10,
            'delivery_fee': 2000.0,
            'customization_fee': 7000.0,
            'installation_fee': 9000.0,
            'warranty_note': '2 years warranty',
            'image_url': 'https://example.com/dg_sync_panel.jpg',
            'reorder_level': 1,
        },
    ]
    for prod in power_products:
        if not session.query(Product).filter_by(sku=prod['sku']).first():
            product = Product(
                name=prod['name'],
                sku=prod['sku'],
                category=prod['category'],
                quantity=prod['quantity'],
                unit=prod['unit'],
                cost=prod['cost'],
                base_price=prod['base_price'],
                procurement_cost=prod['procurement_cost'],
                min_load_kw=prod['min_load_kw'],
                max_load_kw=prod['max_load_kw'],
                voltage_rating=prod['voltage_rating'],
                phase_type=prod['phase_type'],
                application_tags=json.dumps(prod['application_tags']),
                compliance_tags=json.dumps(prod['compliance_tags']),
                features=json.dumps(prod['features']),
                mount_type=prod['mount_type'],
                lead_time_days=prod['lead_time_days'],
                delivery_fee=prod['delivery_fee'],
                customization_fee=prod['customization_fee'],
                installation_fee=prod['installation_fee'],
                warranty_note=prod['warranty_note'],
                image_url=prod['image_url'],
                reorder_level=prod['reorder_level'],
                supplier_id=None,  # Master material
                conversion_ratio=1.0
            )
            session.add(product)
            session.commit()

    if not session.query(CompanyHoliday).first():
        holidays = [
            CompanyHoliday(name='New Year\'s Day', date=datetime(datetime.now().year, 1, 1)),
            CompanyHoliday(name='Independence Day', date=datetime(datetime.now().year, 7, 4)),
            CompanyHoliday(name='Christmas Day', date=datetime(datetime.now().year, 12, 25)),
        ]
        session.add_all(holidays)

    session.commit()
    session.close()

def cleanup_non_master_materials():
    from python_backend.models import Product
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    deleted = session.query(Product).filter(Product.supplier_id.isnot(None)).delete(synchronize_session=False)
    session.commit()
    print(f"Deleted {deleted} non-master materials (products with supplier_id not None)")
    session.close()

if __name__ == '__main__':
    create_tables()
    seed_data() 