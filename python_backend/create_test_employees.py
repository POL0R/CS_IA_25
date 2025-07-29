#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from models import Base, User, Employee, Skill, UserRole
from db_init import get_engine
from datetime import datetime
import bcrypt

def create_test_employees():
    # Database connection
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Create test skills if they don't exist
        skills_data = [
            {"name": "Welding", "hourly_rate": 25.0},
            {"name": "Carpentry", "hourly_rate": 22.0},
            {"name": "Electrical", "hourly_rate": 28.0},
            {"name": "Plumbing", "hourly_rate": 24.0},
            {"name": "Assembly", "hourly_rate": 18.0},
            {"name": "Quality Control", "hourly_rate": 20.0},
            {"name": "Machining", "hourly_rate": 30.0},
            {"name": "Painting", "hourly_rate": 19.0},
            {"name": "Fabrication", "hourly_rate": 26.0},
            {"name": "Installation", "hourly_rate": 23.0}
        ]
        
        for skill_data in skills_data:
            existing_skill = session.query(Skill).filter_by(name=skill_data["name"]).first()
            if not existing_skill:
                skill = Skill(name=skill_data["name"])
                session.add(skill)
                session.flush()
                print(f"Created skill: {skill_data['name']}")
            else:
                print(f"Skill already exists: {skill_data['name']}")
        
        # Create test users and employees
        employees_data = [
            {
                "username": "john_welder",
                "email": "john.welder@company.com",
                "password": "password123",
                "first_name": "John",
                "last_name": "Smith",
                "skills": ["Welding", "Fabrication"],
                "hourly_rate": 26.0,
                "location": "Factory A"
            },
            {
                "username": "sarah_carpenter",
                "email": "sarah.carpenter@company.com",
                "password": "password123",
                "first_name": "Sarah",
                "last_name": "Johnson",
                "skills": ["Carpentry", "Assembly"],
                "hourly_rate": 23.0,
                "location": "Factory B"
            },
            {
                "username": "mike_electrician",
                "email": "mike.electrician@company.com",
                "password": "password123",
                "first_name": "Mike",
                "last_name": "Davis",
                "skills": ["Electrical", "Installation"],
                "hourly_rate": 29.0,
                "location": "Factory A"
            },
            {
                "username": "lisa_plumber",
                "email": "lisa.plumber@company.com",
                "password": "password123",
                "first_name": "Lisa",
                "last_name": "Wilson",
                "skills": ["Plumbing", "Installation"],
                "hourly_rate": 25.0,
                "location": "Factory C"
            },
            {
                "username": "tom_assembler",
                "email": "tom.assembler@company.com",
                "password": "password123",
                "first_name": "Tom",
                "last_name": "Brown",
                "skills": ["Assembly", "Quality Control"],
                "hourly_rate": 19.0,
                "location": "Factory B"
            },
            {
                "username": "anna_machinist",
                "email": "anna.machinist@company.com",
                "password": "password123",
                "first_name": "Anna",
                "last_name": "Garcia",
                "skills": ["Machining", "Quality Control"],
                "hourly_rate": 31.0,
                "location": "Factory A"
            },
            {
                "username": "david_painter",
                "email": "david.painter@company.com",
                "password": "password123",
                "first_name": "David",
                "last_name": "Martinez",
                "skills": ["Painting", "Quality Control"],
                "hourly_rate": 20.0,
                "location": "Factory C"
            },
            {
                "username": "emma_fabricator",
                "email": "emma.fabricator@company.com",
                "password": "password123",
                "first_name": "Emma",
                "last_name": "Taylor",
                "skills": ["Fabrication", "Welding"],
                "hourly_rate": 27.0,
                "location": "Factory A"
            },
            {
                "username": "james_installer",
                "email": "james.installer@company.com",
                "password": "password123",
                "first_name": "James",
                "last_name": "Anderson",
                "skills": ["Installation", "Electrical"],
                "hourly_rate": 24.0,
                "location": "Factory B"
            },
            {
                "username": "maria_quality",
                "email": "maria.quality@company.com",
                "password": "password123",
                "first_name": "Maria",
                "last_name": "Rodriguez",
                "skills": ["Quality Control", "Assembly"],
                "hourly_rate": 21.0,
                "location": "Factory C"
            }
        ]
        
        for emp_data in employees_data:
            # Check if user already exists
            existing_user = session.query(User).filter_by(username=emp_data["username"]).first()
            if existing_user:
                print(f"User already exists: {emp_data['username']}")
                continue
            
            # Create user
            password_hash = bcrypt.hashpw(emp_data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user = User(
                username=emp_data["username"],
                email=emp_data["email"],
                password_hash=password_hash,
                role=UserRole.employee,
                last_login=None
            )
            session.add(user)
            session.flush()
            
            # Create employee
            employee = Employee(
                user_id=user.id,
                first_name=emp_data["first_name"],
                last_name=emp_data["last_name"],
                email=emp_data["email"],
                skills=", ".join(emp_data["skills"]),
                hourly_rate=emp_data["hourly_rate"],
                efficiency_rating=0.85,  # Default efficiency rating
                max_workload=40.0,  # 40 hours per week
                current_workload=0.0,
                location=emp_data["location"],
                is_available=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            session.add(employee)
            
            print(f"Created employee: {emp_data['first_name']} {emp_data['last_name']} - {emp_data['skills']}")
        
        session.commit()
        print("\nTest employees created successfully!")
        
        # Display summary
        print("\nEmployee Summary:")
        employees = session.query(Employee).all()
        for emp in employees:
            user = session.query(User).filter_by(id=emp.user_id).first()
            print(f"- {emp.first_name} {emp.last_name}: ${emp.hourly_rate}/hr, Skills: {emp.skills}")
        
        # Display skills summary
        print("\nSkills Summary:")
        skills = session.query(Skill).all()
        for skill in skills:
            # Calculate average hourly rate for this skill
            employees_with_skill = session.query(Employee).filter(
                Employee.skills.like(f"%{skill.name}%")
            ).all()
            
            if employees_with_skill:
                avg_rate = sum(emp.hourly_rate for emp in employees_with_skill) / len(employees_with_skill)
                print(f"- {skill.name}: ${avg_rate:.2f}/hr average ({len(employees_with_skill)} employees)")
            else:
                print(f"- {skill.name}: No employees with this skill")
        
    except Exception as e:
        session.rollback()
        print(f"Error creating test employees: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    create_test_employees() 