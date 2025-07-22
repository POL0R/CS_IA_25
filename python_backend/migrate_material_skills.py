#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from db_init import get_engine

def migrate_material_skills():
    """Add material_skills table and description column to products"""
    engine = get_engine()
    
    with engine.connect() as conn:
        try:
            # Add description column to products table if it doesn't exist
            conn.execute(text("""
                ALTER TABLE products 
                ADD COLUMN description TEXT
            """))
            print("✓ Added description column to products table")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("✓ Description column already exists in products table")
            else:
                print(f"Error adding description column: {e}")
        
        try:
            # Create material_skills table
            conn.execute(text("""
                CREATE TABLE material_skills (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    material_id INTEGER NOT NULL,
                    skill_id INTEGER NOT NULL,
                    FOREIGN KEY (material_id) REFERENCES products (id),
                    FOREIGN KEY (skill_id) REFERENCES skills (id)
                )
            """))
            print("✓ Created material_skills table")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("✓ material_skills table already exists")
            else:
                print(f"Error creating material_skills table: {e}")
        
        # Commit the changes
        conn.commit()
        print("✓ Migration completed successfully")

if __name__ == "__main__":
    migrate_material_skills() 