import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(__file__))

from routers import trip, chat, incident
from database.db import init_db

app = FastAPI(
    title="Wayzyy TripOS Backend API",
    description="Adaptive AI Travel Operating System API for post-booking trip management, constraint scoring, and recovery.",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB on startup
init_db()

# Include Routers
app.include_router(trip.router)
app.include_router(chat.router)
app.include_router(incident.router)

@app.get("/")
def root():
    return {
        "system": "Wayzyy TripOS API",
        "status": "ONLINE",
        "vision": "Others generate your itinerary. Wayzyy keeps it alive."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
