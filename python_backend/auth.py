from sqlalchemy.orm import sessionmaker
from models import User, UserRole
from db_init import get_engine
import hashlib

def verify_login(username, password):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    user = session.query(User).filter_by(username=username).first()
    if user:
        # Hash the provided password
        password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
        # Check if it matches the stored hash
        if password_hash == user.password_hash:
            return {'success': True, 'role': user.role.value, 'user_id': user.id}
    return {'success': False, 'role': None, 'user_id': None}

def create_user(username, password, role='storekeeper'):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    if session.query(User).filter_by(username=username).first():
        return {'success': False, 'error': 'Username already exists'}
    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    user = User(username=username, password_hash=password_hash, role=UserRole(role))
    session.add(user)
    session.commit()
    return {'success': True, 'user_id': user.id}

def update_user_password(username, new_password):
    """Update a user's password to the new hashing format"""
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    user = session.query(User).filter_by(username=username).first()
    if user:
        password_hash = hashlib.sha256(new_password.encode('utf-8')).hexdigest()
        user.password_hash = password_hash
        session.commit()
        return {'success': True}
    return {'success': False, 'error': 'User not found'}

if __name__ == '__main__':
    # Example usage
    print(verify_login('admin', 'admin123'))
    print(create_user('store1', 'storepass', 'storekeeper')) 