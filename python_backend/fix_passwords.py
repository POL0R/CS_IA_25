from sqlalchemy.orm import sessionmaker
from models import User
from db_init import get_engine
import hashlib
import bcrypt

def fix_user_passwords():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Update all users to use bcrypt for password 'password123' (or keep admin as 'admin123')
    users = session.query(User).all()
    for user in users:
        if user.username == 'admin':
            password = 'admin123'
        else:
            password = 'password123'
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user.password_hash = password_hash
            print(f"Updated {user.username} password hash: {password_hash}")
    session.commit()
    print("All user passwords have been updated to bcrypt format")

if __name__ == '__main__':
    fix_user_passwords() 