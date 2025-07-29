import os
import requests
from sqlalchemy.orm import sessionmaker
from db_init import get_engine
from models import Supplier

MAPBOX_TOKEN = os.environ.get('MAPBOX_TOKEN') or '<YOUR_MAPBOX_TOKEN_HERE>'

if MAPBOX_TOKEN == '<YOUR_MAPBOX_TOKEN_HERE>':
    print('ERROR: Please set your Mapbox token in the script or as MAPBOX_TOKEN environment variable.')
    exit(1)

def geocode_address(address):
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json?access_token={MAPBOX_TOKEN}&country=IN"
    resp = requests.get(url)
    data = resp.json()
    if data.get('features') and len(data['features']) > 0:
        lng, lat = data['features'][0]['center']
        return lat, lng
    return None, None

def batch_geocode_suppliers():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()
    
    suppliers = session.query(Supplier).filter((Supplier.lat == None) | (Supplier.lng == None)).all()
    print(f"Found {len(suppliers)} suppliers to geocode.")
    updated = 0
    for supplier in suppliers:
        if not supplier.address:
            print(f"Skipping supplier {supplier.id} ({supplier.name}): No address.")
            continue
        print(f"Geocoding supplier {supplier.id} ({supplier.name}): {supplier.address}")
        lat, lng = geocode_address(supplier.address)
        if lat is not None and lng is not None:
            supplier.lat = lat
            supplier.lng = lng
            session.commit()
            print(f"Updated supplier {supplier.id} with lat={lat}, lng={lng}")
            updated += 1
        else:
            print(f"Failed to geocode supplier {supplier.id} ({supplier.name})")
    print(f"Done. Updated {updated} suppliers.")
    session.close()

if __name__ == '__main__':
    batch_geocode_suppliers() 