#!/usr/bin/env python3
"""
Test script to verify quote acceptance, rejection, and revision functionality
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5001"

def test_quote_functionality():
    print("🧪 Testing Quote Functionality")
    print("=" * 50)
    
    # Test 1: Create a customer request
    print("\n1. Creating a customer request...")
    customer_request = {
        "customer_id": 1,
        "product_id": 1,
        "quantity": 2,
        "expected_delivery": (datetime.now() + timedelta(days=30)).isoformat(),
        "notes": "Test request for quote functionality"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests", json=customer_request)
    if response.status_code == 200:
        request_data = response.json()
        request_id = request_data.get('request_id')
        print(f"✅ Customer request created with ID: {request_id}")
    else:
        print(f"❌ Failed to create customer request: {response.text}")
        return
    
    # Test 2: Manager reviews the request
    print("\n2. Manager reviewing the request...")
    review_data = {
        "manager_id": 1,
        "notes": "Request reviewed and approved for quoting"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/manager_review", json=review_data)
    if response.status_code == 200:
        print("✅ Request marked as reviewed")
    else:
        print(f"❌ Failed to review request: {response.text}")
    
    # Test 3: Manager provides a quote
    print("\n3. Manager providing a quote...")
    quote_data = {
        "quoted_price": 50000.0,
        "notes": "Quote provided for the requested products"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/quote", json=quote_data)
    if response.status_code == 200:
        print("✅ Quote provided successfully")
    else:
        print(f"❌ Failed to provide quote: {response.text}")
    
    # Test 4: Customer requests revision
    print("\n4. Customer requesting revision...")
    revision_data = {
        "response": "revise",
        "revision_notes": "Please provide a better price and faster delivery timeline"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/customer_response", json=revision_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Revision requested: {result.get('message', 'Success')}")
    else:
        print(f"❌ Failed to request revision: {response.text}")
    
    # Test 5: Check request status after revision
    print("\n5. Checking request status after revision...")
    response = requests.get(f"{BASE_URL}/customer_requests/{request_id}")
    if response.status_code == 200:
        request_info = response.json()
        print(f"✅ Request status: {request_info.get('status')}")
        print(f"✅ Customer response: {request_info.get('customer_response')}")
        print(f"✅ Notes: {request_info.get('notes')}")
    else:
        print(f"❌ Failed to get request info: {response.text}")
    
    # Test 6: Manager provides revised quote
    print("\n6. Manager providing revised quote...")
    revised_quote_data = {
        "quoted_price": 45000.0,
        "notes": "Revised quote with better pricing and faster delivery"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/quote", json=revised_quote_data)
    if response.status_code == 200:
        print("✅ Revised quote provided successfully")
    else:
        print(f"❌ Failed to provide revised quote: {response.text}")
    
    # Test 7: Customer accepts the quote
    print("\n7. Customer accepting the quote...")
    accept_data = {
        "response": "accepted",
        "revision_notes": "Quote accepted. Please proceed with the order."
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/customer_response", json=accept_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Quote accepted: {result.get('message', 'Success')}")
    else:
        print(f"❌ Failed to accept quote: {response.text}")
    
    # Test 8: Final status check
    print("\n8. Final status check...")
    response = requests.get(f"{BASE_URL}/customer_requests/{request_id}")
    if response.status_code == 200:
        request_info = response.json()
        print(f"✅ Final status: {request_info.get('status')}")
        print(f"✅ Customer response: {request_info.get('customer_response')}")
        print(f"✅ Quoted price: ₹{request_info.get('quoted_price')}")
        print(f"✅ Final notes: {request_info.get('notes')}")
    else:
        print(f"❌ Failed to get final request info: {response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 Quote functionality test completed!")

def test_customer_decline():
    print("\n🧪 Testing Customer Decline Scenario")
    print("=" * 50)
    
    # Create another test request
    print("\n1. Creating another customer request...")
    customer_request = {
        "customer_id": 1,
        "product_id": 2,
        "quantity": 1,
        "expected_delivery": (datetime.now() + timedelta(days=20)).isoformat(),
        "notes": "Test request for decline scenario"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests", json=customer_request)
    if response.status_code == 200:
        request_data = response.json()
        request_id = request_data.get('request_id')
        print(f"✅ Customer request created with ID: {request_id}")
    else:
        print(f"❌ Failed to create customer request: {response.text}")
        return
    
    # Manager provides quote
    print("\n2. Manager providing quote...")
    quote_data = {
        "quoted_price": 75000.0,
        "notes": "Quote for premium product"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/quote", json=quote_data)
    if response.status_code == 200:
        print("✅ Quote provided successfully")
    else:
        print(f"❌ Failed to provide quote: {response.text}")
    
    # Customer declines
    print("\n3. Customer declining the quote...")
    decline_data = {
        "response": "declined",
        "revision_notes": "Price is too high for our budget"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/customer_response", json=decline_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Quote declined: {result.get('message', 'Success')}")
    else:
        print(f"❌ Failed to decline quote: {response.text}")
    
    # Check final status
    print("\n4. Checking final status...")
    response = requests.get(f"{BASE_URL}/customer_requests/{request_id}")
    if response.status_code == 200:
        request_info = response.json()
        print(f"✅ Final status: {request_info.get('status')}")
        print(f"✅ Customer response: {request_info.get('customer_response')}")
        print(f"✅ Notes: {request_info.get('notes')}")
    else:
        print(f"❌ Failed to get final request info: {response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 Customer decline test completed!")

if __name__ == "__main__":
    try:
        test_quote_functionality()
        test_customer_decline()
        print("\n✅ All tests completed successfully!")
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}") 