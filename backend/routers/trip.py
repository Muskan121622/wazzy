import sys
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from database.db import get_connection

router = APIRouter(prefix="/api/trip", tags=["Trip"])

class PreferenceUpdate(BaseModel):
    user_id: str = "user_1"
    quietness: float = 0.9
    seafood: float = 0.9
    budget_max: int = 1800
    crowd_tolerance: float = 0.2
    energy_level: str = "medium"

@router.get("/{trip_id}")
def get_trip_details(trip_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM trips WHERE id = ?", (trip_id,))
    trip_row = cursor.fetchone()
    if not trip_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Trip not found")

    trip = dict(trip_row)

    # Fetch User Preferences
    cursor.execute("SELECT * FROM preferences WHERE user_id = ?", (trip['user_id'],))
    pref_row = cursor.fetchone()
    preferences = dict(pref_row) if pref_row else {}

    # Need GIS functions to compute exact distances for the UI
    from services.gis import haversine_distance, resolve_location_coordinates
    origin_coord = resolve_location_coordinates(trip['destination'] if trip.get('destination') else 'Goa')

    # Fetch Itinerary Items joined with Places
    cursor.execute("""
    SELECT i.id as item_id, i.day_number, i.time_slot, i.time_period, i.status, i.version,
           p.id as place_id, p.name as place_name, p.area, p.category, p.indoor_flag,
           p.crowd_level, p.price, p.rating, p.opening_hours, p.description, p.plan_b_id, p.lat, p.lon,
           fb.name as fallback_name, fb.category as fallback_category
    FROM itinerary_items i
    JOIN places p ON i.place_id = p.id
    LEFT JOIN places fb ON i.fallback_place_id = fb.id
    WHERE i.trip_id = ?
    ORDER BY i.day_number ASC, CASE i.time_period WHEN 'Morning' THEN 1 WHEN 'Afternoon' THEN 2 WHEN 'Evening' THEN 3 ELSE 4 END
    """, (trip_id,))

    items_rows = cursor.fetchall()

    # Group by Day
    days = {}
    for r in items_rows:
        row_dict = dict(r)
        d_num = row_dict['day_number']
        if d_num not in days:
            days[d_num] = []
            
        # Calculate distance explicitly for the UI
        dist_km = haversine_distance(origin_coord['lat'], origin_coord['lon'], row_dict['lat'] or 15.5, row_dict['lon'] or 73.7)

        # Calculate duration based on category
        cat_lower = (row_dict['category'] or '').lower()
        if 'restaurant' in cat_lower or 'food' in cat_lower or 'cafe' in cat_lower:
            duration_hrs = 1.5
        elif 'beach' in cat_lower:
            duration_hrs = 3.0
        elif 'nature' in cat_lower or 'farm' in cat_lower or 'plantation' in cat_lower:
            duration_hrs = 2.5
        elif 'shopping' in cat_lower or 'market' in cat_lower:
            duration_hrs = 2.0
        else:
            duration_hrs = 1.5 # Default for indoor/culture/forts

        days[d_num].append({
            "item_id": row_dict['item_id'],
            "time_slot": row_dict['time_slot'],
            "time_period": row_dict['time_period'],
            "status": row_dict['status'],
            "version": row_dict['version'],
            "place": {
                "id": row_dict['place_id'],
                "name": row_dict['place_name'],
                "area": row_dict['area'],
                "category": row_dict['category'],
                "indoor_flag": bool(row_dict['indoor_flag']),
                "crowd_level": row_dict['crowd_level'],
                "price": row_dict['price'],
                "rating": row_dict['rating'],
                "description": row_dict['description'],
                "distance_km": round(dist_km, 1),
                "duration_hrs": duration_hrs
            },
            "fallback": {
                "name": row_dict['fallback_name'],
                "category": row_dict['fallback_category']
            } if row_dict['fallback_name'] else None
        })

    # Fetch Version Log
    cursor.execute("SELECT * FROM trip_versions WHERE trip_id = ? ORDER BY id DESC", (trip_id,))
    versions = [dict(v) for v in cursor.fetchall()]

    # Fetch Audit Actions
    cursor.execute("SELECT * FROM agent_actions WHERE trip_id = ? ORDER BY id DESC LIMIT 5", (trip_id,))
    actions = [dict(a) for a in cursor.fetchall()]

    conn.close()

    return {
        "trip": trip,
        "preferences": preferences,
        "itinerary_days": days,
        "versions": versions,
        "audit_actions": actions
    }

@router.post("/preferences")
def update_preferences(pref: PreferenceUpdate):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO preferences (user_id, quietness, seafood, budget_max, crowd_tolerance, energy_level)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        quietness = excluded.quietness,
        seafood = excluded.seafood,
        budget_max = excluded.budget_max,
        crowd_tolerance = excluded.crowd_tolerance,
        energy_level = excluded.energy_level
    """, (pref.user_id, pref.quietness, pref.seafood, pref.budget_max, pref.crowd_tolerance, pref.energy_level))

    conn.commit()
    conn.close()

    return {"status": "SUCCESS", "message": "Trip preferences updated and synced."}

class TripGenerateRequest(BaseModel):
    user_name: str = "Muskan"
    destination: str = "Baga, Goa"
    days_count: int = 4
    quietness: float = 0.9
    seafood: float = 0.9
    total_budget: int = 15000
    budget_max: int = 1800
    crowd_tolerance: float = 0.2
    energy_level: str = "medium"
    start_date: str = "2026-09-20"
    end_date: str = "2026-09-24"
    dest_lat: float = None
    dest_lon: float = None

@router.post("/generate")
def generate_trip(req: TripGenerateRequest):
    from services.optimizer import generate_custom_trip
    res = generate_custom_trip(
        user_name=req.user_name,
        destination=req.destination,
        days_count=req.days_count,
        quietness=req.quietness,
        seafood=req.seafood,
        total_budget=req.total_budget,
        crowd_tolerance=req.crowd_tolerance,
        energy_level=req.energy_level,
        start_date=req.start_date,
        end_date=req.end_date,
        dest_lat=req.dest_lat,
        dest_lon=req.dest_lon
    )
    return res

