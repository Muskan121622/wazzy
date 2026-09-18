import sqlite3
import json
import os
from db import get_connection, init_db

def seed_data():
    init_db(reset=True)
    conn = get_connection()
    cursor = conn.cursor()

    # Seed User
    user_id = "user_1"
    cursor.execute("INSERT INTO users VALUES (?, ?, ?)", (user_id, "Muskan", "muskan@example.com"))

    # Seed Preferences
    cursor.execute("""
    INSERT INTO preferences (user_id, quietness, seafood, budget_max, crowd_tolerance, energy_level)
    VALUES (?, 0.9, 0.9, 1800, 0.2, 'medium')
    """, (user_id,))

    # Seed Places
    places_file = os.path.join(os.path.dirname(__file__), "..", "data", "goa_places.json")
    with open(places_file, "r") as f:
        places_list = json.load(f)

    for p in places_list:
        cursor.execute("""
        INSERT INTO places (id, name, area, category, indoor_flag, crowd_level, price, rating, opening_hours, lat, lon, source, description, plan_b_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            p["id"], p["name"], p["area"], p["category"],
            1 if p.get("indoor_flag") else 0,
            p["crowd_level"], p["price"], p["rating"],
            p.get("opening_hours", ""),
            p.get("lat", 15.5553), p.get("lon", 73.7517),
            p.get("source", "HuggingFace/Kaggle"),
            p.get("description", ""),
            p.get("plan_b_id", None)
        ))

    # Seed Trip
    trip_id = "trip_1"
    cursor.execute("""
    INSERT INTO trips (id, user_id, destination, start_date, end_date, health_score, current_version)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (trip_id, user_id, "Baga, Goa", "2026-09-20", "2026-09-24", 86, 1))

    # Seed Itinerary Items
    initial_items = [
        # Day 1
        ("item_101", trip_id, 1, "09:30 AM", "Morning", "place_10", "SCHEDULED", "place_7", 1), # Assagao Bakery
        ("item_102", trip_id, 1, "02:00 PM", "Afternoon", "place_1", "SCHEDULED", "place_7", 1), # Baga Beach (Outdoor!)
        ("item_103", trip_id, 1, "07:30 PM", "Evening", "place_3", "SCHEDULED", None, 1), # Souza Lobo

        # Day 2
        ("item_201", trip_id, 2, "09:30 AM", "Morning", "place_5", "SCHEDULED", "place_7", 1), # Quiet Vagator Cove
        ("item_202", trip_id, 2, "02:00 PM", "Afternoon", "place_2", "SCHEDULED", "place_8", 1), # Fort Aguada (Outdoor!)
        ("item_203", trip_id, 2, "07:30 PM", "Evening", "place_6", "SCHEDULED", None, 1), # Gunpowder

        # Day 3
        ("item_301", trip_id, 3, "10:00 AM", "Morning", "place_9", "SCHEDULED", None, 1), # Fontainhas Latin Walk
        ("item_302", trip_id, 3, "03:00 PM", "Afternoon", "place_11", "SCHEDULED", "place_8", 1), # Chapora Fort
        ("item_303", trip_id, 3, "07:30 PM", "Evening", "place_12", "SCHEDULED", None, 1), # Mum's Kitchen

        # Day 4
        ("item_401", trip_id, 4, "10:00 AM", "Morning", "place_14", "SCHEDULED", "place_10", 1), # Morjim Turtle Beach
        ("item_402", trip_id, 4, "01:30 PM", "Afternoon", "place_15", "SCHEDULED", None, 1) # Thalassa
    ]

    for item in initial_items:
        cursor.execute("""
        INSERT INTO itinerary_items (id, trip_id, day_number, time_slot, time_period, place_id, status, fallback_place_id, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, item)

    # Initial Version log
    cursor.execute("""
    INSERT INTO trip_versions (trip_id, version_number, change_description)
    VALUES (?, ?, ?)
    """, (trip_id, 1, "Initial Living Itinerary generated matching quietness & budget preferences."))

    conn.commit()
    conn.close()
    print("Database re-seeded successfully with reset=True!")

if __name__ == "__main__":
    seed_data()
