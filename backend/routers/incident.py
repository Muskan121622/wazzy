import sys
import os
from fastapi import APIRouter
from pydantic import BaseModel

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from services.monitor import create_recovery_proposal, approve_recovery_proposal, evaluate_schedule_delay
from services.optimizer import get_right_now_recommendation
from services.host_service import get_host_recommendations

router = APIRouter(prefix="/api/incident", tags=["Incident & Recovery"])

class IncidentTriggerRequest(BaseModel):
    trip_id: str = "trip_1"
    condition: str = "HEAVY_RAIN"
    day_number: int = 1
    time_slot: str = "02:00 PM"

class ProposalApproveRequest(BaseModel):
    proposal_id: str
    trip_id: str = "trip_1"

class DelayEvaluationRequest(BaseModel):
    trip_id: str = "trip_1"
    day_number: int = 1
    delay_minutes: int = 45
    delayed_item_id: str = None
    user_lat: float = None
    user_lon: float = None
    speed_kmh: float = 25.0

@router.post("/trigger")
def trigger_incident(req: IncidentTriggerRequest):
    res = create_recovery_proposal(
        trip_id=req.trip_id,
        condition=req.condition,
        day_number=req.day_number,
        time_slot=req.time_slot
    )
    return res

@router.post("/evaluate-delay")
def evaluate_delay(req: DelayEvaluationRequest):
    res = evaluate_schedule_delay(
        trip_id=req.trip_id,
        day_number=req.day_number,
        delayed_item_id=req.delayed_item_id,
        delay_minutes=req.delay_minutes,
        user_lat=req.user_lat,
        user_lon=req.user_lon,
        speed_kmh=req.speed_kmh
    )
    return res

@router.post("/approve")
def approve_proposal(req: ProposalApproveRequest):
    res = approve_recovery_proposal(proposal_id=req.proposal_id, trip_id=req.trip_id)
    return res

@router.get("/right-now")
def get_right_now(trip_id: str = "trip_1", is_rainy: bool = False):
    res = get_right_now_recommendation(trip_id=trip_id, is_rainy=is_rainy)
    return {"candidates": res}

@router.get("/host-tips")
def get_host_tips(trip_id: str = "trip_1"):
    res = get_host_recommendations(trip_id=trip_id)
    return {"host_tips": res}
