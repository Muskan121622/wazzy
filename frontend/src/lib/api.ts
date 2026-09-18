import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = {
  getTrip: async (tripId: string = 'trip_1') => {
    const res = await axios.get(`${API_BASE}/trip/${tripId}`);
    return res.data;
  },

  updatePreferences: async (pref: {
    user_id?: string;
    quietness: number;
    seafood: number;
    budget_max: number;
    crowd_tolerance: number;
    energy_level: string;
  }) => {
    const res = await axios.post(`${API_BASE}/trip/preferences`, pref);
    return res.data;
  },

  triggerIncident: async (
    tripId: string = 'trip_1',
    condition: string = 'HEAVY_RAIN',
    dayNumber: number = 1,
    timeSlot: string = '02:00 PM'
  ) => {
    const res = await axios.post(`${API_BASE}/incident/trigger`, {
      trip_id: tripId,
      condition,
      day_number: dayNumber,
      time_slot: timeSlot,
    });
    return res.data;
  },

  evaluateDelay: async (
    tripId: string = 'trip_1',
    dayNumber: number = 1,
    delayMinutes: number = 45,
    userLat?: number,
    userLon?: number,
    speedKmh: number = 25.0
  ) => {
    const res = await axios.post(`${API_BASE}/incident/evaluate-delay`, {
      trip_id: tripId,
      day_number: dayNumber,
      delay_minutes: delayMinutes,
      user_lat: userLat,
      user_lon: userLon,
      speed_kmh: speedKmh,
    });
    return res.data;
  },

  approveProposal: async (proposalId: string, tripId: string = 'trip_1') => {
    const res = await axios.post(`${API_BASE}/incident/approve`, {
      proposal_id: proposalId,
      trip_id: tripId,
    });
    return res.data;
  },

  getRightNow: async (tripId: string = 'trip_1', isRainy: boolean = false) => {
    const res = await axios.get(`${API_BASE}/incident/right-now`, {
      params: { trip_id: tripId, is_rainy: isRainy },
    });
    return res.data;
  },

  getHostTips: async (tripId: string = 'trip_1') => {
    const res = await axios.get(`${API_BASE}/incident/host-tips`, {
      params: { trip_id: tripId },
    });
    return res.data;
  },

  chatWithAgent: async (
    userMessage: string,
    tripId: string = 'trip_1',
    destination?: string,
    history?: { role: string; content: string }[]
  ) => {
    const res = await axios.post(`${API_BASE}/chat`, {
      user_message: userMessage,
      trip_id: tripId,
      destination: destination || null,
      history: history || [],
    });
    return res.data;
  },

  generateTrip: async (data: {
    user_name: string;
    destination: string;
    days_count: number;
    quietness: number;
    seafood: number;
    total_budget?: number;
    budget_max?: number;
    crowd_tolerance: number;
    energy_level: string;
    start_date?: string;
    end_date?: string;
    dest_lat?: number;
    dest_lon?: number;
  }) => {
    const res = await axios.post(`${API_BASE}/trip/generate`, data);
    return res.data;
  },
};
