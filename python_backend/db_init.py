from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base, User, UserRole, Product, Customer, Warehouse, Employee, Project, ProjectRequirement, ProjectStatus, Requisition, RequisitionStatus, Supplier, Transaction, Skill, FinishedProduct, FinishedProductSkill, FinishedProductMaterial, ProjectTask, ProjectTaskDependency, ProjectTaskMaterial, CompanyHoliday, Order
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
    
    # Add sample products if not exists
    if not session.query(Product).filter_by(sku='ATS120').first():
        supplier = session.query(Supplier).first()
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
            supplier_id=supplier.id if supplier else None,
            conversion_ratio=1.0
        )
        session.add(product)
        session.commit()
    # Add example order for demo
    customer = session.query(Customer).first()
    product = session.query(Product).filter_by(sku='ATS120').first()
    if customer and product and not session.query(Order).filter_by(order_number='ORD-DEMO-001').first():
        order = Order(
            order_number='ORD-DEMO-001',
            customer_id=customer.id,
            user_id=1,
            status='pending',
            order_date=datetime.now(),
            delivery_date=datetime.now() + timedelta(days=7),
            total_amount=131300.0,
            profit_amount=20000.0,
            notes='Demo order',
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(order)
        session.commit()
    
    if not session.query(Product).filter_by(sku='SKU002').first():
        supplier2 = session.query(Supplier).filter_by(name='Piyush Dhumal').first()
        if not supplier2:
            supplier2 = Supplier(
                name='Piyush Dhumal',
                email='dhumalpiyush08@gmail.com',
                phone='9860093451',
                address='FB - 102, Shravandhara\nSasane Nagar, Hadapsar',
                company='Asian Power',
                tax_id='TAX23534',
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            session.add(supplier2)
            session.commit()
        
        product2 = Product(
            name='Office Chair',
            sku='SKU002',
            category='Furniture',
            quantity=25,
            unit='pcs',
            cost=150.0,
            reorder_level=5,
            supplier_id=supplier2.id,
            conversion_ratio=1.0
        )
        session.add(product2)
    
    if not session.query(Product).filter_by(sku='SKU003').first():
        supplier3 = session.query(Supplier).filter_by(name='Agastya').first()
        if not supplier3:
            supplier3 = Supplier(
                name='Agastya',
                email='dhumalpiyush08@gmail.com',
                phone='9860093451',
                address='FB - 102, Shravandhara\nSasane Nagar, Hadapsar',
                company='Mangu',
                tax_id='TAX23534',
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            session.add(supplier3)
            session.commit()
        
        product3 = Product(
            name='Software License',
            sku='SKU003',
            category='Software',
            quantity=100,
            unit='licenses',
            cost=50.0,
            reorder_level=20,
            supplier_id=supplier3.id,
            conversion_ratio=1.0
        )
        session.add(product3)
    
    session.commit()
    
    # Update existing products that don't have suppliers assigned
    products_without_suppliers = session.query(Product).filter(Product.supplier_id.is_(None)).all()
    suppliers = session.query(Supplier).all()
    
    if products_without_suppliers and suppliers:
        for i, product in enumerate(products_without_suppliers):
            # Assign suppliers in round-robin fashion
            supplier = suppliers[i % len(suppliers)]
            product.supplier_id = supplier.id
        session.commit()
    
    # Create sample project
    if not session.query(Project).filter_by(name='Office Renovation Project').first():
        pm_user = session.query(User).filter_by(username='pm1').first()
        project = Project(
            name='Office Renovation Project',
            description='Complete renovation of the main office building including new furniture, electronics, and software upgrades.',
            project_manager_id=pm_user.id,
            status='incoming',
            priority='high',
            budget=50000.0,
            start_date=datetime.now(),
            deadline=datetime.now() + timedelta(days=90),
            predicted_end_date=None,
            working_hours_per_day=8,
            approval_buffer_days=5,
            location='Main Office Building',
            transportation_cost=500.0,
            total_cost=0.0,
            progress=0.0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(project)
        session.commit()
        
        # Add project requirements
        product1 = session.query(Product).filter_by(sku='SKU001').first()
        product2 = session.query(Product).filter_by(sku='SKU002').first()
        product3 = session.query(Product).filter_by(sku='SKU003').first()
        
        req1 = ProjectRequirement(
            project_id=project.id,
            product_id=product1.id,
            quantity_required=20,
            quantity_ordered=0,
            quantity_received=0,
            specifications=json.dumps({'specs': 'High-performance laptops for development team'}),
            priority='high',
            is_ordered=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(req1)
        
        req2 = ProjectRequirement(
            project_id=project.id,
            product_id=product2.id,
            quantity_required=30,
            quantity_ordered=0,
            quantity_received=0,
            specifications=json.dumps({'specs': 'Ergonomic office chairs'}),
            priority='medium',
            is_ordered=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(req2)
        
        req3 = ProjectRequirement(
            project_id=project.id,
            product_id=product3.id,
            quantity_required=50,
            quantity_ordered=0,
            quantity_received=0,
            specifications=json.dumps({'specs': 'Project management software licenses'}),
            priority='normal',
            is_ordered=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        session.add(req3)
    
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

    if not session.query(CompanyHoliday).first():
        holidays = [
            CompanyHoliday(name='New Year\'s Day', date=datetime(datetime.now().year, 1, 1)),
            CompanyHoliday(name='Independence Day', date=datetime(datetime.now().year, 7, 4)),
            CompanyHoliday(name='Christmas Day', date=datetime(datetime.now().year, 12, 25)),
        ]
        session.add_all(holidays)

    session.commit()
    session.close()

if __name__ == '__main__':
    create_tables()
    seed_data() 