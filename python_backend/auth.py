from sqlalchemy.orm import sessionmaker
from models import User, UserRole
from db_init import get_engine
import bcrypt

def verify_login(username, password):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    user = session.query(User).filter_by(username=username).first()
    if user:
        # Use bcrypt to check password
        if bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            return {'success': True, 'role': user.role.value, 'user_id': user.id}
    return {'success': False, 'role': None, 'user_id': None}

def create_user(username, password, role='storekeeper'):
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    if session.query(User).filter_by(username=username).first():
        return {'success': False, 'error': 'Username already exists'}
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(username=username, password_hash=password_hash, role=UserRole(role))
    session.add(user)
    session.commit()
    return {'success': True, 'user_id': user.id}

def update_user_password(username, new_password):
    """Update a user's password to the new bcrypt format"""
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    user = session.query(User).filter_by(username=username).first()
    if user:
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user.password_hash = password_hash
        session.commit()
        return {'success': True}
    return {'success': False, 'error': 'User not found'}

if __name__ == '__main__':
    # Example usage
    print(verify_login('admin', 'admin123'))
    print(create_user('store1', 'storepass', 'storekeeper')) 