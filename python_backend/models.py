from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship, declarative_base
import enum
from datetime import datetime
from sqlalchemy import Table

Base = declarative_base()

# Association tables for many-to-many
product_features = Table('product_features', Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id')),
    Column('feature_id', Integer, ForeignKey('features.id'))
)
product_compliance_tags = Table('product_compliance_tags', Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id')),
    Column('compliance_tag_id', Integer, ForeignKey('compliance_tags.id'))
)
finished_product_features = Table('finished_product_features', Base.metadata,
    Column('finished_product_id', Integer, ForeignKey('finished_products.id')),
    Column('feature_id', Integer, ForeignKey('features.id'))
)
finished_product_compliance_tags = Table('finished_product_compliance_tags', Base.metadata,
    Column('finished_product_id', Integer, ForeignKey('finished_products.id')),
    Column('compliance_tag_id', Integer, ForeignKey('compliance_tags.id'))
)

# Association table for many-to-many between SupplierRequest and Supplier
supplier_request_suppliers = Table(
    'supplier_request_suppliers', Base.metadata,
    Column('request_id', Integer, ForeignKey('supplier_requests.id')),
    Column('supplier_id', Integer, ForeignKey('suppliers.id')),
    Column('supplier_status', String(20), default='pending')  # pending, accepted, rejected, quoted
)

# Enums
class UserRole(enum.Enum):
    admin = 'admin'
    storekeeper = 'storekeeper'
    project_manager = 'project_manager'
    employee = 'employee'
    customer = 'customer'
    manager = 'manager'
    transporter = 'transporter'
    supplier = 'supplier'

class OrderStatus(enum.Enum):
    pending = 'pending'
    confirmed = 'confirmed'
    processing = 'processing'
    shipped = 'shipped'
    delivered = 'delivered'
    cancelled = 'cancelled'

class TransactionType(enum.Enum):
    stock_in = 'stock_in'
    stock_out = 'stock_out'

class RequisitionStatus(enum.Enum):
    pending = 'pending'
    approved = 'approved'
    rejected = 'rejected'
    fulfilled = 'fulfilled'

class ProjectStatus(enum.Enum):
    incoming = 'incoming'
    processing = 'processing'
    transit = 'transit'
    on_hold = 'on_hold'
    completed = 'completed'
    cancelled = 'cancelled'

# Models
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    last_login = Column(DateTime)
    login_ip = Column(String(45))
    is_spam = Column(Boolean)
    banned_email = Column(Boolean)
    # Relationships
    orders = relationship('Order', back_populates='user')
    transactions = relationship('Transaction', back_populates='user')

class Customer(Base):
    __tablename__ = 'customers'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100))
    phone = Column(String(20))
    address = Column(Text)
    company = Column(String(100))
    tax_id = Column(String(50))
    credit_limit = Column(Float)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    orders = relationship('Order', back_populates='customer')

class Supplier(Base):
    __tablename__ = 'suppliers'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100))
    phone = Column(String(20))
    address = Column(Text)
    company = Column(String(100))
    tax_id = Column(String(50))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    lat = Column(Float)
    lng = Column(Float)
    is_spam = Column(Boolean)
    banned_email = Column(Boolean)
    registration_complete = Column(Boolean, default=False)
    products = relationship('Product', back_populates='supplier')
    transactions = relationship('Transaction', back_populates='supplier')

class Product(Base):
    __tablename__ = 'products'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    sku = Column(String(30), unique=True, nullable=False)
    category = Column(String(50))
    quantity = Column(Float)
    unit = Column(String(20))
    cost = Column(Float)  # procurement_cost
    base_price = Column(Float)  # selling price
    procurement_cost = Column(Float)  # internal cost (for clarity)
    min_load_kw = Column(Integer)
    max_load_kw = Column(Integer)
    voltage_rating = Column(Integer)
    phase_type = Column(String(20))  # 'Single', '3-phase'
    application_tags = Column(Text)  # JSON string
    compliance_tags = Column(Text)   # JSON string
    features = Column(Text)          # JSON string
    mount_type = Column(String(20))  # 'Indoor', 'Outdoor'
    lead_time_days = Column(Integer)
    delivery_fee = Column(Float)
    customization_fee = Column(Float)
    installation_fee = Column(Float)
    warranty_note = Column(Text)
    image_url = Column(Text)
    reorder_level = Column(Float)
    supplier_id = Column(Integer, ForeignKey('suppliers.id'))
    conversion_ratio = Column(Float)
    last_updated = Column(DateTime)
    email_sent_count = Column(Integer)
    photo_url = Column(Text)
    description = Column(Text)
    supplier = relationship('Supplier', back_populates='products')
    order_items = relationship('OrderItem', back_populates='product')
    transactions = relationship('Transaction', back_populates='product')
    finished_products = relationship('FinishedProduct', secondary='finished_product_materials', back_populates='materials')
    skills = relationship('Skill', secondary='material_skills', back_populates='materials')
    # features = relationship('Feature', secondary=product_features, backref='products')
    # compliance_tags = relationship('ComplianceTag', secondary=product_compliance_tags, backref='products')

class Order(Base):
    __tablename__ = 'orders'
    id = Column(Integer, primary_key=True)
    order_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey('customers.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    status = Column(Enum(OrderStatus))
    order_date = Column(DateTime)
    delivery_date = Column(DateTime)
    proposed_deadline = Column(DateTime)  # New field for customer's proposed deadline
    delivery_address = Column(Text)  # New field for delivery location
    total_amount = Column(Float)
    profit_amount = Column(Float)  # new field for margin tracking
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    customer = relationship('Customer', back_populates='orders')
    user = relationship('User', back_populates='orders')
    order_items = relationship('OrderItem', back_populates='order')

class OrderItem(Base):
    __tablename__ = 'order_items'
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.id'))
    product_id = Column(Integer, ForeignKey('products.id'))
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    notes = Column(String(255))
    order = relationship('Order', back_populates='order_items')
    product = relationship('Product', back_populates='order_items')

class Transaction(Base):
    __tablename__ = 'transactions'
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey('products.id'))
    type = Column(Enum(TransactionType))
    quantity = Column(Float)
    date = Column(DateTime)
    note = Column(String(255))
    user_id = Column(Integer, ForeignKey('users.id'))
    batch_id = Column(Integer, ForeignKey('batches.id'))
    batch = relationship('Batch', back_populates='transactions')
    location = Column(String(50))
    customer_id = Column(Integer, ForeignKey('customers.id'))
    supplier_id = Column(Integer, ForeignKey('suppliers.id'))
    product = relationship('Product', back_populates='transactions')
    user = relationship('User', back_populates='transactions')
    supplier = relationship('Supplier', back_populates='transactions')

class Batch(Base):
    __tablename__ = 'batches'
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey('products.id'))
    batch_id = Column(String(50))
    quantity = Column(Float)
    mfg_date = Column(DateTime)
    exp_date = Column(DateTime)
    product = relationship('Product')
    transactions = relationship('Transaction', back_populates='batch')

# Add more models as needed for your app's features. 
class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    location = Column(String(255))
    lat = Column(Float)
    lng = Column(Float)


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True)
    phone = Column(String(20))
    skills = Column(Text)
    hourly_rate = Column(Float)
    efficiency_rating = Column(Float)
    max_workload = Column(Float)
    current_workload = Column(Float)
    location = Column(String(100))
    is_available = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    # Relationships
    assignments = relationship('EmployeeAssignment', back_populates='employee')


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    project_manager_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(20))
    priority = Column(String(20))
    budget = Column(Float)
    start_date = Column(DateTime)
    deadline = Column(DateTime)
    predicted_end_date = Column(DateTime)  # New field for the predicted end date
    working_hours_per_day = Column(Float, default=8.0)
    approval_buffer_days = Column(Integer, default=0)
    location = Column(String(200))
    lat = Column(Float)
    lng = Column(Float)
    transportation_cost = Column(Float)
    total_cost = Column(Float)
    progress = Column(Float)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    # Relationships
    project_manager = relationship('User')
    requirements = relationship('ProjectRequirement', back_populates='project')
    assignments = relationship('EmployeeAssignment', back_populates='project')
    tasks = relationship('ProjectTask', back_populates='project', cascade="all, delete-orphan")


class ProjectTask(Base):
    __tablename__ = 'project_tasks'
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    name = Column(String(200), nullable=False)
    duration_days = Column(Float, nullable=False)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    project = relationship('Project', back_populates='tasks')
    dependencies = relationship('ProjectTaskDependency', foreign_keys='ProjectTaskDependency.task_id', back_populates='task', cascade="all, delete-orphan")
    dependents = relationship('ProjectTaskDependency', foreign_keys='ProjectTaskDependency.dependency_id', back_populates='dependency', cascade="all, delete-orphan")
    material_requirements = relationship('ProjectTaskMaterial', back_populates='task', cascade="all, delete-orphan")

class ProjectTaskDependency(Base):
    __tablename__ = 'project_task_dependencies'
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('project_tasks.id'), nullable=False)
    dependency_id = Column(Integer, ForeignKey('project_tasks.id'), nullable=False)

    task = relationship('ProjectTask', foreign_keys=[task_id], back_populates='dependencies')
    dependency = relationship('ProjectTask', foreign_keys=[dependency_id], back_populates='dependents')

class ProjectTaskMaterial(Base):
    __tablename__ = 'project_task_materials'
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('project_tasks.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    quantity = Column(Float, nullable=False)
    is_in_stock = Column(Boolean, default=True)
    lead_time_days = Column(Integer, default=0)

    task = relationship('ProjectTask', back_populates='material_requirements')
    product = relationship('Product')

class CompanyHoliday(Base):
    __tablename__ = 'company_holidays'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    date = Column(DateTime, nullable=False, unique=True)


class ProjectRequirement(Base):
    __tablename__ = "project_requirements"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity_required = Column(Float, nullable=False)
    quantity_ordered = Column(Float)
    quantity_received = Column(Float)
    specifications = Column(Text)
    priority = Column(String(20))
    is_ordered = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    # Relationships
    project = relationship('Project', back_populates='requirements')
    product = relationship('Product')


class Requisition(Base):
    __tablename__ = "requisitions"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    requested_by = Column(String(100))
    quantity = Column(Float, nullable=False)
    priority = Column(String(20))
    timestamp = Column(DateTime)
    status = Column(String(20))


class EmployeeAssignment(Base):
    __tablename__ = "employee_assignments"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    assigned_hours = Column(Float)
    actual_hours = Column(Float)
    role = Column(String(100))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    is_active = Column(Boolean)
    performance_rating = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    # Relationships
    project = relationship('Project', back_populates='assignments')
    employee = relationship('Employee', back_populates='assignments')


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    
    # Relationships
    finished_products = relationship('FinishedProduct', secondary='finished_product_skills', back_populates='skills')
    materials = relationship('Product', secondary='material_skills', back_populates='skills')


class FinishedProduct(Base):
    __tablename__ = "finished_products"
    id = Column(Integer, primary_key=True)
    model_name = Column(String(100), nullable=False)
    total_cost = Column(Float)  # Cost price (materials + labor)
    profit_margin_percent = Column(Float, default=20.0)  # Default 20% profit margin
    base_price = Column(Float)  # Selling price (total_cost + profit)
    materials_json = Column(Text)
    photo_url = Column(Text)
    weight = Column(Float)  # Add weight field
    # Recommendation parameters
    phase_type = Column(String(20))
    mount_type = Column(String(20))
    compliance_tags = Column(Text)   # JSON string
    features = Column(Text)          # JSON string
    application_tags = Column(Text)  # JSON string
    voltage_rating = Column(Integer)
    min_load_kw = Column(Integer)
    max_load_kw = Column(Integer)
    estimated_hours = Column(Float)
    # Relationships
    skills = relationship('Skill', secondary='finished_product_skills', back_populates='finished_products')
    materials = relationship('Product', secondary='finished_product_materials', back_populates='finished_products')
    # features = relationship('Feature', secondary=finished_product_features, backref='finished_products')
    # compliance_tags = relationship('ComplianceTag', secondary=finished_product_compliance_tags, backref='finished_products')


class FinishedProductSkill(Base):
    __tablename__ = "finished_product_skills"
    id = Column(Integer, primary_key=True)
    finished_product_id = Column(Integer, ForeignKey("finished_products.id"))
    skill_id = Column(Integer, ForeignKey("skills.id"))

class FinishedProductMaterial(Base):
    __tablename__ = "finished_product_materials"
    id = Column(Integer, primary_key=True)
    finished_product_id = Column(Integer, ForeignKey("finished_products.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)

class MaterialSkill(Base):
    __tablename__ = "material_skills"
    id = Column(Integer, primary_key=True)
    material_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)


class CustomerRequest(Base):
    __tablename__ = "customer_requests"
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float, nullable=False)
    expected_delivery = Column(DateTime)
    delivery_address = Column(Text)
    status = Column(String(20))
    manager_id = Column(Integer, ForeignKey("users.id"))
    quoted_price = Column(Float)
    customer_response = Column(String(20))
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    transporter_id = Column(Integer, ForeignKey("users.id"))
    # Relationships for joinedload
    product = relationship("Product")
    customer = relationship("User", foreign_keys=[customer_id])
    manager = relationship("User", foreign_keys=[manager_id])


class ProjectOrder(Base):
    __tablename__ = "project_orders"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    order_number = Column(String(50), unique=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    total_amount = Column(Float)
    transportation_cost = Column(Float)
    status = Column(String(20))
    order_date = Column(DateTime)
    expected_delivery = Column(DateTime)
    actual_delivery = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    field_changed = Column(String(50))
    old_value = Column(String(255))
    new_value = Column(String(255))
    timestamp = Column(DateTime)


class CustomerRequestStatus(enum.Enum):
    submitted = "submitted"
    manager_review = "manager_review"
    quoted = "quoted"
    customer_accepted = "customer_accepted"
    customer_declined = "customer_declined"
    in_transit = "in_transit"
    completed = "completed"
    cancelled = "cancelled"


class SupplierProduct(Base):
    __tablename__ = "supplier_products"
    id = Column(Integer, primary_key=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    current_stock = Column(Float)
    unit_price = Column(Float)
    reorder_level = Column(Float)
    is_active = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class SupplierRequest(Base):
    __tablename__ = "supplier_requests"
    id = Column(Integer, primary_key=True)
    request_number = Column(String(50), unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    requester_id = Column(Integer, ForeignKey("users.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))  # keep for backward compatibility
    project_id = Column(Integer, ForeignKey("projects.id"))
    priority = Column(String(50))
    status = Column(String(50))
    expected_delivery_date = Column(DateTime)
    delivery_address = Column(Text)
    total_amount = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    # New: many-to-many relationship
    suppliers = relationship('Supplier', secondary='supplier_request_suppliers', backref='requests')


class SupplierRequestItem(Base):
    __tablename__ = "supplier_request_items"
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("supplier_requests.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    unit_price = Column(Float)
    total_price = Column(Float)
    specifications = Column(Text)
    notes = Column(Text)


class SupplierInvoice(Base):
    __tablename__ = "supplier_invoices"
    id = Column(Integer, primary_key=True)
    invoice_number = Column(String(50), unique=True, nullable=False)
    request_id = Column(Integer, ForeignKey("supplier_requests.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    issue_date = Column(DateTime)
    due_date = Column(DateTime)
    subtotal = Column(Float)
    tax_amount = Column(Float)
    shipping_amount = Column(Float)
    discount_amount = Column(Float)
    total_amount = Column(Float)
    status = Column(String(20))
    payment_terms = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class SupplierInvoiceItem(Base):
    __tablename__ = "supplier_invoice_items"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("supplier_invoices.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    unit_price = Column(Float)
    total_price = Column(Float)
    description = Column(Text)


class SupplierRequestStatus(enum.Enum):
    draft = "draft"
    sent = "sent"
    pending = "pending"
    supplier_reviewing = "supplier_reviewing"
    supplier_quoted = "supplier_quoted"
    admin_reviewing = "admin_reviewing"
    approved = "approved"
    accepted = "accepted"
    rejected = "rejected"
    confirmed = "confirmed"
    in_production = "in_production"
    ready_for_delivery = "ready_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"


class SupplierInvoiceStatus(enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class WarehouseRequest(Base):
    __tablename__ = "warehouse_requests"
    id = Column(Integer, primary_key=True)
    request_number = Column(String(50), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    requester_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    priority = Column(String(20))
    status = Column(String(20))
    required_delivery_date = Column(DateTime)
    delivery_address = Column(Text)
    total_predicted_amount = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class WarehouseRequestItem(Base):
    __tablename__ = "warehouse_request_items"
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("warehouse_requests.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity_required = Column(Float)
    predicted_unit_price = Column(Float)
    predicted_total_price = Column(Float)
    specifications = Column(Text)
    priority = Column(String(20))
    notes = Column(Text)


class SupplierQuote(Base):
    __tablename__ = "supplier_quotes"
    id = Column(Integer, primary_key=True)
    quote_number = Column(String(50), unique=True, nullable=False)
    request_id = Column(Integer, ForeignKey("warehouse_requests.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    total_amount = Column(Float)
    delivery_cost = Column(Float)
    tax_amount = Column(Float)
    total_with_tax = Column(Float)
    estimated_delivery_date = Column(DateTime)
    delivery_terms = Column(String(200))
    status = Column(String(20))
    submitted_at = Column(DateTime)
    expires_at = Column(DateTime)
    accepted_at = Column(DateTime)
    rejected_at = Column(DateTime)
    notes = Column(Text)
    terms_conditions = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    fulfillment_date = Column(DateTime)  # New field for supplier's proposed fulfillment date


class SupplierQuoteItem(Base):
    __tablename__ = "supplier_quote_items"
    id = Column(Integer, primary_key=True)
    quote_id = Column(Integer, ForeignKey("supplier_quotes.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    unit_price = Column(Float)
    total_price = Column(Float)
    available_stock = Column(Float)
    lead_time_days = Column(Integer)
    specifications = Column(Text)
    notes = Column(Text)


class WarehouseRequestStatus(enum.Enum):
    draft = "draft"
    sent_to_suppliers = "sent_to_suppliers"
    suppliers_reviewing = "suppliers_reviewing"
    supplier_quoted = "supplier_quoted"
    admin_reviewing = "admin_reviewing"
    supplier_selected = "supplier_selected"
    order_placed = "order_placed"
    delivered = "delivered"
    cancelled = "cancelled"


class SupplierQuoteStatus(enum.Enum):
    pending = "pending"
    submitted = "submitted"
    accepted = "accepted"
    rejected = "rejected"
    expired = "expired"


class RequirementsHistory(Base):
    __tablename__ = 'requirements_history'
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey('customers.id'))
    input_json = Column(Text)  # raw user input as JSON string
    matched_product_id = Column(Integer, ForeignKey('products.id'))
    accepted = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationships
    customer = relationship('Customer')
    matched_product = relationship('Product')


class Feature(Base):
    __tablename__ = 'features'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

class ComplianceTag(Base):
    __tablename__ = 'compliance_tags'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

class ApplicationTag(Base):
    __tablename__ = 'application_tags'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SupplierRequestQuote(Base):
    __tablename__ = "supplier_request_quotes"
    id = Column(Integer, primary_key=True)
    quote_number = Column(String(50), unique=True, nullable=False)
    request_id = Column(Integer, ForeignKey("supplier_requests.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    total_amount = Column(Float)
    status = Column(String(20))
    fulfillment_date = Column(DateTime)
    packed_date = Column(DateTime)  # New: when supplier marks as packed
    dispatched_date = Column(DateTime)  # New: when supplier marks as dispatched
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

# New models for supplier negotiations
class SupplierNegotiation(Base):
    __tablename__ = "supplier_negotiations"
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("supplier_requests.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    offer_type = Column(String(20))  # 'revised_offer', 'counter_offer'
    total_amount = Column(Float)
    notes = Column(Text)
    status = Column(String(20), default='pending')  # 'pending', 'accepted', 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationships
    request = relationship('SupplierRequest')
    supplier = relationship('Supplier')
    items = relationship('SupplierNegotiationItem', back_populates='negotiation', cascade="all, delete-orphan")

class SupplierNegotiationItem(Base):
    __tablename__ = "supplier_negotiation_items"
    id = Column(Integer, primary_key=True)
    negotiation_id = Column(Integer, ForeignKey("supplier_negotiations.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    unit_price = Column(Float)
    total_price = Column(Float)
    specifications = Column(Text)
    notes = Column(Text)
    # Relationships
    negotiation = relationship('SupplierNegotiation', back_populates='items')
    product = relationship('Product')
    # Add more fields as needed (e.g., delivery_terms, notes, etc.)


class CustomerNegotiation(Base):
    __tablename__ = "customer_negotiations"
    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("customer_requests.id"))
    customer_id = Column(Integer, ForeignKey("users.id"))
    offer_type = Column(String(20))  # 'customer_offer', 'admin_counter', 'finalized'
    total_amount = Column(Float)
    notes = Column(Text)
    status = Column(String(20), default='pending')  # 'pending', 'accepted', 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relationships
    request = relationship('CustomerRequest')
    customer = relationship('User')
    items = relationship('CustomerNegotiationItem', back_populates='negotiation', cascade="all, delete-orphan")

class CustomerNegotiationItem(Base):
    __tablename__ = "customer_negotiation_items"
    id = Column(Integer, primary_key=True)
    negotiation_id = Column(Integer, ForeignKey("customer_negotiations.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    unit_price = Column(Float)
    total_price = Column(Float)
    specifications = Column(Text)
    notes = Column(Text)
    # Relationships
    negotiation = relationship('CustomerNegotiation', back_populates='items')
    product = relationship('Product')

