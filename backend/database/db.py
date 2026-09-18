import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tripos.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(reset=False):
    conn = get_connection()
    cursor = conn.cursor()

    if reset:
        cursor.executescript("""
        DROP TABLE IF EXISTS recovery_proposals;
        DROP TABLE IF EXISTS itinerary_items;
        DROP TABLE IF EXISTS agent_actions;
        DROP TABLE IF EXISTS trip_versions;
        DROP TABLE IF EXISTS preferences;
        DROP TABLE IF EXISTS trips;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS places;
        """)

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        destination TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        health_score INTEGER DEFAULT 86,
        current_version INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS preferences (
        user_id TEXT PRIMARY KEY,
        quietness REAL DEFAULT 0.9,
        seafood REAL DEFAULT 0.9,
        budget_max INTEGER DEFAULT 2000,
        crowd_tolerance REAL DEFAULT 0.2,
        energy_level TEXT DEFAULT 'medium',
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        area TEXT NOT NULL,
        category TEXT NOT NULL,
        indoor_flag BOOLEAN DEFAULT 0,
        crowd_level TEXT NOT NULL,
        price INTEGER DEFAULT 0,
        rating REAL DEFAULT 4.5,
        opening_hours TEXT,
        lat REAL DEFAULT 15.5553,
        lon REAL DEFAULT 73.7517,
        source TEXT,
        description TEXT,
        plan_b_id TEXT
    );

    CREATE TABLE IF NOT EXISTS itinerary_items (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        day_number INTEGER NOT NULL,
        time_slot TEXT NOT NULL,
        time_period TEXT NOT NULL,
        place_id TEXT NOT NULL,
        status TEXT DEFAULT 'SCHEDULED',
        fallback_place_id TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY(trip_id) REFERENCES trips(id),
        FOREIGN KEY(place_id) REFERENCES places(id)
    );

    CREATE TABLE IF NOT EXISTS recovery_proposals (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        trip_version INTEGER NOT NULL,
        original_item_id TEXT NOT NULL,
        proposed_place_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        score REAL DEFAULT 91.5,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
    );

    CREATE TABLE IF NOT EXISTS agent_actions (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        tool_used TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'SUCCESS',
        FOREIGN KEY(trip_id) REFERENCES trips(id)
    );

    CREATE TABLE IF NOT EXISTS trip_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        change_description TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db(reset=True)
