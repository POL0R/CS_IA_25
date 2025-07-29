#!/usr/bin/env python3
"""
Simple test script to verify quote functionality
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5001"

def test_basic_quote_flow():
    print("🧪 Testing Basic Quote Flow")
    print("=" * 50)
    
    # 1. Create customer request
    print("\n1. Creating customer request...")
    customer_request = {
        "customer_id": 1,
        "product_id": 1,
        "quantity": 2,
        "expected_delivery": (datetime.now() + timedelta(days=30)).isoformat(),
        "notes": "Test request for quote functionality"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests", json=customer_request)
    print(f"Response: {response.text}")
    
    if response.status_code in [200, 201]:
        request_data = response.json()
        if request_data.get('success'):
            request_id = request_data.get('request_id')
            print(f"✅ Customer request created with ID: {request_id}")
        else:
            print("❌ Request creation failed")
            return
    else:
        print(f"❌ HTTP error: {response.status_code}")
        return
    
    # 2. Manager provides quote
    print(f"\n2. Manager providing quote for request {request_id}...")
    quote_data = {
        "quoted_price": 50000.0,
        "notes": "Quote provided for the requested products"
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/quote", json=quote_data)
    print(f"Quote response: {response.text}")
    
    if response.status_code in [200, 201]:
        print("✅ Quote provided successfully")
    else:
        print(f"❌ Failed to provide quote: {response.text}")
        return
    
    # 3. Customer accepts quote
    print(f"\n3. Customer accepting quote for request {request_id}...")
    accept_data = {
        "response": "accepted",
        "revision_notes": "Quote accepted. Please proceed with the order."
    }
    
    response = requests.post(f"{BASE_URL}/customer_requests/{request_id}/customer_response", json=accept_data)
    print(f"Accept response: {response.text}")
    
    if response.status_code in [200, 201]:
        result = response.json()
        print(f"✅ Quote accepted: {result.get('message', 'Success')}")
    else:
        print(f"❌ Failed to accept quote: {response.text}")
        return
    
    # 4. Check final status
    print(f"\n4. Checking final status for request {request_id}...")
    response = requests.get(f"{BASE_URL}/customer_requests/{request_id}")
    print(f"Status response: {response.text}")
    
    if response.status_code in [200, 201]:
        request_info = response.json()
        print(f"✅ Final status: {request_info.get('status')}")
        print(f"✅ Customer response: {request_info.get('customer_response')}")
        print(f"✅ Quoted price: ₹{request_info.get('quoted_price')}")
    else:
        print(f"❌ Failed to get request info: {response.text}")
    
    print("\n" + "=" * 50)
    print("🎉 Basic quote flow test completed!")

if __name__ == "__main__":
    try:
        test_basic_quote_flow()
        print("\n✅ Test completed successfully!")
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}") 