import math
import urllib.request
import urllib.parse
import json

# Center coordinates for Goa & major travel hubs (OpenStreetMap / GIS Data)
GOA_AREA_COORDINATES = {
    "Baga": {"lat": 15.5553, "lon": 73.7517},
    "Calangute": {"lat": 15.5437, "lon": 73.7553},
    "Candolim": {"lat": 15.5178, "lon": 73.7634},
    "Anjuna": {"lat": 15.5872, "lon": 73.7439},
    "Vagator": {"lat": 15.6030, "lon": 73.7336},
    "Assagao": {"lat": 15.5900, "lon": 73.7700},
    "Panaji": {"lat": 15.4989, "lon": 73.8278},
    "Porvorim": {"lat": 15.5342, "lon": 73.8202},
    "Siolim": {"lat": 15.6174, "lon": 73.7712},
    "Morjim": {"lat": 15.6322, "lon": 73.7258},
    "Mandrem": {"lat": 15.6667, "lon": 73.7167},
    "Arambol": {"lat": 15.6869, "lon": 73.7042},
    "Verem": {"lat": 15.5050, "lon": 73.8050},
    "Mapusa": {"lat": 15.5925, "lon": 73.8130},
    "Old Goa": {"lat": 15.5039, "lon": 73.9118},
    "Ponda": {"lat": 15.4026, "lon": 74.0150},
    "Agonda": {"lat": 15.0441, "lon": 73.9877},
    "Palolem": {"lat": 15.0100, "lon": 74.0230},
    "Colva": {"lat": 15.2785, "lon": 73.9145},
    "Cabo de Rama": {"lat": 15.0886, "lon": 73.9192},
    "Canacona": {"lat": 15.0069, "lon": 74.0435},
    "Margao": {"lat": 15.2736, "lon": 73.9581},
    "Benaulim": {"lat": 15.2600, "lon": 73.9200},
    "Cavelossim": {"lat": 15.1741, "lon": 73.9405},
    "Vasco": {"lat": 15.3982, "lon": 73.8113},
    "Dabolim": {"lat": 15.3800, "lon": 73.8316}
}

_coord_cache = {}

def resolve_location_coordinates(location_str: str) -> dict:
    """
    Dynamically resolves exact latitude and longitude for ANY location string.
    First checks static dictionary, then calls live OpenStreetMap Nominatim Geocoder API.
    """
    if not location_str:
        return {"lat": 15.5553, "lon": 73.7517, "clean_name": "Baga"}

    # Check cache
    if location_str in _coord_cache:
        return _coord_cache[location_str]

    # Check static map
    for area_key, coord in GOA_AREA_COORDINATES.items():
        if area_key.lower() in location_str.lower():
            res = {"lat": coord["lat"], "lon": coord["lon"], "clean_name": area_key}
            _coord_cache[location_str] = res
            return res

    # Live OpenStreetMap Nominatim Geocoding API call
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={urllib.parse.quote(location_str)}&limit=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'Wayzyy-TripOS/1.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                display = data[0].get("display_name", location_str).split(",")[0]
                res = {"lat": lat, "lon": lon, "clean_name": display}
                _coord_cache[location_str] = res
                return res
    except Exception as e:
        print(f"Nominatim geocode notice ({e}) for {location_str}")

    # Fallback to Baga if completely unreachable
    res = {"lat": 15.5553, "lon": 73.7517, "clean_name": location_str.split(',')[0]}
    _coord_cache[location_str] = res
    return res

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great circle distance between two points on the Earth in kilometers
    using the Haversine formula (GIS Spatial Calculation).
    """
    R = 6371.0 # Earth radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance_km = R * c

    return round(distance_km, 2)

def get_distance_between_areas(origin_area: str, destination_area: str) -> float:
    """
    Returns spatial distance in km between two areas using OpenStreetMap GIS centroids.
    """
    c1 = resolve_location_coordinates(origin_area)
    c2 = resolve_location_coordinates(destination_area)
    return haversine_distance(c1["lat"], c1["lon"], c2["lat"], c2["lon"])
