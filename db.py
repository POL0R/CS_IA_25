from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Use MySQL with pymysql driver and the correct database
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:newpassword@localhost/stock_db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base() 