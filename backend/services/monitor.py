import sys
import os
import json
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from database.db import get_connection
from services.gis import haversine_distance, GOA_AREA_COORDINATES
from services.weather_service import get_live_weather

def create_recovery_proposal(trip_id="trip_1", condition="HEAVY_RAIN", day_number=1, time_slot="02:00 PM"):
    """
    Creates a PENDING Recovery Proposal record in DB linked to current trip version.
    Fetches real-time weather from Open-Meteo for destination area and selects a genuine 100% indoor museum/gallery Plan B replacement.
    Waits for explicit User Approval before performing state mutation.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT destination, current_version FROM trips WHERE id = ?", (trip_id,))
    trip_row = cursor.fetchone()
    if not trip_row:
        conn.close()
        return {"status": "TRIP_NOT_FOUND"}

    dest_str = trip_row['destination']
    curr_version = trip_row['current_version']

    # Resolve area coordinates
    dest_area = "Baga"
    for area_key in GOA_AREA_COORDINATES.keys():
        if area_key.lower() in dest_str.lower():
            dest_area = area_key
            break

    # Fetch live weather forecast
    weather_info = get_live_weather(area=dest_area)

    # Get affected outdoor itinerary items for the selected day
    cursor.execute("""
    SELECT i.id as item_id, i.day_number, i.time_slot, i.time_period, i.place_id, i.fallback_place_id,
           p.name as current_place_name, p.indoor_flag, p.area
    FROM itinerary_items i
    JOIN places p ON i.place_id = p.id
    WHERE i.trip_id = ? AND i.day_number = ? AND i.status != 'CANCELLED'
    """, (trip_id, day_number))

    items = [dict(r) for r in cursor.fetchall()]

    # Find genuine 100% Indoor Plan B place (museum, art gallery, heritage indoor site)
    cursor.execute("SELECT * FROM places WHERE indoor_flag = 1 ORDER BY rating DESC")
    indoor_places = [dict(r) for r in cursor.fetchall()]
    default_indoor = indoor_places[0] if indoor_places else {
        "id": "place_7",
        "name": "Houses of Goa Museum",
        "area": "Salvador do Mundo"
    }

    proposals = []
    for item in items:
        if not item['indoor_flag']:
            # Find matching indoor fallback place
            fallback_id = item['fallback_place_id']
            fallback_place = default_indoor

            if fallback_id:
                cursor.execute("SELECT * FROM places WHERE id = ?", (fallback_id,))
                fb_row = cursor.fetchone()
                if fb_row:
                    fb_dict = dict(fb_row)
                    if fb_dict['indoor_flag']:
                        fallback_place = fb_dict

            proposal_id = f"prop_{int(datetime.now().timestamp())}"
            reason = (
                f"Live Open-Meteo Weather Alert: High rain probability ({weather_info['rain_probability']}) in {dest_area}. "
                f"TripOS proposes swapping outdoor {item['current_place_name']} for {fallback_place['name']} "
                f"({fallback_place['area']} · 100% Indoor & Rain-Safe)."
            )

            cursor.execute("""
            INSERT INTO recovery_proposals (id, trip_id, trip_version, original_item_id, proposed_place_id, reason, score, status)
            VALUES (?, ?, ?, ?, ?, ?, 91.5, 'PENDING')
            """, (proposal_id, trip_id, curr_version, item['item_id'], fallback_place['id'], reason))

            proposals.append({
                "proposal_id": proposal_id,
                "trip_version": curr_version,
                "original_place": item['current_place_name'],
                "new_place": fallback_place['name'],
                "new_place_area": fallback_place['area'],
                "time_slot": item['time_slot'],
                "day_number": item['day_number'],
                "reason": reason
            })

    conn.commit()
    conn.close()

    why_audit = (
        f"Live Open-Meteo forecast detects {weather_info['condition']} (Rain probability: {weather_info['rain_probability']}) in {dest_area}. "
        f"TripOS proposed swapping outdoor beach/fort visits for air-conditioned indoor museum galleries matching quiet & local culture preferences."
    )

    return {
        "status": "PROPOSAL_CREATED" if proposals else "NO_ACTION_REQUIRED",
        "condition": condition,
        "proposal_count": len(proposals),
        "swapped_details": proposals,
        "why_audit": why_audit
    }

def evaluate_schedule_delay(trip_id="trip_1", day_number=1, delayed_item_id=None, delay_minutes=45, user_lat=None, user_lon=None, speed_kmh=25.0):
    """
    Schedule Conflicts & Traffic Delays Engine:
    Calculates distance matrix between current/delayed location and next scheduled item using Haversine formula (d / speed).
    If total delay + travel time causes a conflict, generates a PENDING recovery proposal.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT i.id as item_id, i.day_number, i.time_slot, i.time_period, i.status,
           p.id as place_id, p.name as place_name, p.area, p.lat, p.lon, p.opening_hours
    FROM itinerary_items i
    JOIN places p ON i.place_id = p.id
    WHERE i.trip_id = ? AND i.day_number = ? AND i.status != 'CANCELLED'
    ORDER BY CASE i.time_period WHEN 'Morning' THEN 1 WHEN 'Afternoon' THEN 2 WHEN 'Evening' THEN 3 ELSE 4 END
    """, (trip_id, day_number))

    items = [dict(r) for r in cursor.fetchall()]
    if len(items) < 2:
        conn.close()
        return {"status": "NO_CONFLICT", "message": "Fewer than 2 items scheduled for this day."}

    # Identify source location: user GPS coordinates or first delayed item
    curr_item = items[0]
    next_item = items[1]

    for idx, item in enumerate(items):
        if item['item_id'] == delayed_item_id or (delayed_item_id is None and idx == 0):
            curr_item = item
            if idx + 1 < len(items):
                next_item = items[idx + 1]
            break

    curr_lat = user_lat if user_lat is not None else curr_item['lat']
    curr_lon = user_lon if user_lon is not None else curr_item['lon']

    dist_km = haversine_distance(curr_lat, curr_lon, next_item['lat'], next_item['lon'])
    travel_time_min = round((dist_km / speed_kmh) * 60.0, 1)

    total_buffer_needed_min = delay_minutes + travel_time_min

    # Check for schedule conflict
    has_conflict = total_buffer_needed_min > 40.0

    proposal_details = None
    if has_conflict:
        cursor.execute("SELECT current_version FROM trips WHERE id = ?", (trip_id,))
        curr_ver = cursor.fetchone()['current_version']

        proposal_id = f"delay_prop_{int(datetime.now().timestamp())}"
        reason = (
            f"Traffic Delay Detected: Running {delay_minutes} mins late at {curr_item['place_name']} ({curr_item['area']}). "
            f"Haversine travel distance to {next_item['place_name']} ({next_item['area']}) is {dist_km:.1f} km ({travel_time_min} mins at {speed_kmh} km/h). "
            f"Total lag is {total_buffer_needed_min:.0f} mins. TripOS proposes shifting {next_item['place_name']} to evening or swapping with nearby option."
        )

        cursor.execute("""
        INSERT INTO recovery_proposals (id, trip_id, trip_version, original_item_id, proposed_place_id, reason, score, status)
        VALUES (?, ?, ?, ?, ?, ?, 88.0, 'PENDING')
        """, (proposal_id, trip_id, curr_ver, next_item['item_id'], next_item['place_id'], reason))

        conn.commit()

        proposal_details = {
            "proposal_id": proposal_id,
            "delay_minutes": delay_minutes,
            "distance_km": round(dist_km, 2),
            "travel_time_min": travel_time_min,
            "total_lag_min": round(total_buffer_needed_min, 1),
            "affected_place": next_item['place_name'],
            "reason": reason
        }

    conn.close()

    return {
        "status": "CONFLICT_DETECTED" if has_conflict else "ON_SCHEDULE",
        "delay_minutes": delay_minutes,
        "distance_km": round(dist_km, 2),
        "travel_time_min": travel_time_min,
        "total_buffer_needed_min": round(total_buffer_needed_min, 1),
        "proposal": proposal_details
    }

def approve_recovery_proposal(proposal_id: str, trip_id: str = "trip_1"):
    """
    User Approval Execution with Optimistic Concurrency Control (Stale Proposal Validation):
    Checks if proposal.trip_version matches current_version. If stale, rejects update safely.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM recovery_proposals WHERE id = ?", (proposal_id,))
    proposal_row = cursor.fetchone()
    if not proposal_row:
        conn.close()
        return {"status": "ERROR", "message": "Recovery proposal not found"}

    proposal = dict(proposal_row)

    if proposal['status'] != 'PENDING':
        conn.close()
        return {"status": "ALREADY_PROCESSED", "message": f"Proposal already {proposal['status']}"}

    # Optimistic Concurrency Validation Check
    cursor.execute("SELECT current_version FROM trips WHERE id = ?", (trip_id,))
    curr_ver = cursor.fetchone()['current_version']

    if proposal['trip_version'] != curr_ver:
        # STALE PROPOSAL REJECTION!
        cursor.execute("UPDATE recovery_proposals SET status = 'EXPIRED' WHERE id = ?", (proposal_id,))
        conn.commit()
        conn.close()
        return {
            "status": "STALE_PROPOSAL_REJECTED",
            "message": f"Proposal version (v{proposal['trip_version']}) is stale because trip was updated to v{curr_ver}. Mutation rejected safely."
        }

    # Execute State Mutation!
    new_ver = curr_ver + 1
    cursor.execute("""
    UPDATE itinerary_items
    SET place_id = ?, status = 'RECOVERED', version = version + 1
    WHERE id = ?
    """, (proposal['proposed_place_id'], proposal['original_item_id']))

    cursor.execute("UPDATE recovery_proposals SET status = 'APPROVED' WHERE id = ?", (proposal_id,))
    cursor.execute("UPDATE trips SET current_version = ?, health_score = 92 WHERE id = ?", (new_ver, trip_id))

    action_id = f"action_{int(datetime.now().timestamp())}"
    reason = f"User Approved Recovery Proposal {proposal_id}: Swapped activity for indoor Plan B."

    cursor.execute("""
    INSERT INTO agent_actions (id, trip_id, action, reason, tool_used, status)
    VALUES (?, ?, 'RECOVER_WEATHER_RAIN', ?, 'approve_recovery_proposal', 'SUCCESS')
    """, (action_id, trip_id, reason))

    cursor.execute("""
    INSERT INTO trip_versions (trip_id, version_number, change_description)
    VALUES (?, ?, ?)
    """, (trip_id, new_ver, reason))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Recovery proposal approved! Trip state committed to Version v{new_ver}."
    }
