#!/usr/bin/env python3
"""
Migration script to add proposed_deadline and delivery_address fields to the orders table.
Run this script to update your existing database schema.
"""

import os
import sys
from sqlalchemy import create_engine, text
from db_init import get_engine

def migrate_orders_table():
    """Add new fields to the orders table"""
    engine = get_engine()
    
    try:
        with engine.connect() as conn:
            # Check if columns already exist
            result = conn.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'orders' 
                AND COLUMN_NAME IN ('proposed_deadline', 'delivery_address')
            """))
            existing_columns = [row[0] for row in result]
            
            # Add proposed_deadline column if it doesn't exist
            if 'proposed_deadline' not in existing_columns:
                print("Adding proposed_deadline column...")
                conn.execute(text("""
                    ALTER TABLE orders 
                    ADD COLUMN proposed_deadline DATETIME NULL
                """))
                print("✓ Added proposed_deadline column")
            else:
                print("✓ proposed_deadline column already exists")
            
            # Add delivery_address column if it doesn't exist
            if 'delivery_address' not in existing_columns:
                print("Adding delivery_address column...")
                conn.execute(text("""
                    ALTER TABLE orders 
                    ADD COLUMN delivery_address TEXT NULL
                """))
                print("✓ Added delivery_address column")
            else:
                print("✓ delivery_address column already exists")
            
            conn.commit()
            print("\nMigration completed successfully!")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("Starting orders table migration...")
    migrate_orders_table() 