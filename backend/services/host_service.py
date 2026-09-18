import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from database.db import get_connection

def get_host_recommendations(trip_id="trip_1"):
    """
    Host Amplification Layer:
    Retrieves direct recommendations provided by local Wayzyy Superhosts (Rahul & Priya) for the guest's stay.
    """
    knowledge_file = os.path.join(os.path.dirname(__file__), "..", "data", "goa_knowledge.json")
    with open(knowledge_file, "r") as f:
        data = json.load(f)

    host_recs = data.get("host_recommendations", [])

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT destination FROM trips WHERE id = ?", (trip_id,))
    t_row = cursor.fetchone()
    dest_str = t_row['destination'] if t_row else "Goa Stay"
    clean_stay = dest_str.split(',')[0].strip()

    detailed_recs = []
    for rec in host_recs:
        place_id = rec["recommended_place_id"]
        cursor.execute("SELECT * FROM places WHERE id = ?", (place_id,))
        place_row = cursor.fetchone()
        if place_row:
            detailed_recs.append({
                "host_name": rec["host_name"],
                "property": f"Wayzyy Villa & Homestay ({clean_stay})",
                "quote": rec["host_quote"],
                "place": dict(place_row)
            })

    conn.close()
    return detailed_recs
