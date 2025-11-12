import requests
import json

def test_backend():
    base_url = "http://localhost:5000"
    
    endpoints = [
        "/",
        "/api/test", 
        "/api/test-db",
        "/api/products/",
        "/api/products/test"
    ]
    
    for endpoint in endpoints:
        try:
            url = base_url + endpoint
            print(f"\n🔍 Testing {url}")
            response = requests.get(url, timeout=5)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
            else:
                print(f"   Error: {response.text}")
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Cannot connect to {url} - Is the server running?")
        except requests.exceptions.Timeout:
            print(f"   ❌ Timeout connecting to {url}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    test_backend()