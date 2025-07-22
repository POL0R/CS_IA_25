from sqlalchemy.orm import sessionmaker
from models import User
from db_init import get_engine
import hashlib

def fix_user_passwords():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Update admin user password
    admin_user = session.query(User).filter_by(username='admin').first()
    if admin_user:
        # Hash 'admin123' with SHA-256
        password_hash = hashlib.sha256('admin123'.encode('utf-8')).hexdigest()
        admin_user.password_hash = password_hash
        print(f"Updated admin password hash: {password_hash}")
    
    # Update any other users if needed
    users = session.query(User).all()
    for user in users:
        if user.username != 'admin':
            # For other users, set a default password (you can change this)
            default_password = 'password123'
            password_hash = hashlib.sha256(default_password.encode('utf-8')).hexdigest()
            user.password_hash = password_hash
            print(f"Updated {user.username} password hash: {password_hash}")
    
    session.commit()
    print("All user passwords have been updated to SHA-256 format")

if __name__ == '__main__':
    fix_user_passwords() 