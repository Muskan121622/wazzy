'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import GoogleTranslate from '@/components/GoogleTranslate';
import {
  Sparkles,
  CloudRain,
  Clock,
  Home,
  Shield,
  Activity,
  Send,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  Utensils,
  Sun,
  Coffee,
  Building2,
  ChevronRight,
  RefreshCw,
  Cpu,
  X,
  Plus,
  Check,
  Percent,
  Compass,
  Car,
  Navigation,
  Bell,
  Mic,
  MicOff
} from 'lucide-react';
import { api } from '@/lib/api';

export default function ConciergePage() {
  const [tripData, setTripData] = useState<any>(null);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals & Drawers
  const [showRightNow, setShowRightNow] = useState<boolean>(false);
  const [rightNowCandidates, setRightNowCandidates] = useState<any[]>([]);

  const [showHostTips, setShowHostTips] = useState<boolean>(false);
  const [hostTips, setHostTips] = useState<any[]>([]);

  const [showArchitecture, setShowArchitecture] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Recovery Proposal Modal State (AI proposes -> User approves!)
  const [incidentResult, setIncidentResult] = useState<any>(null);
  const [showIncidentToast, setShowIncidentToast] = useState<boolean>(false);

  // Traffic Delay Evaluation State
  const [delayResult, setDelayResult] = useState<any>(null);
  const [showDelayModal, setShowDelayModal] = useState<boolean>(false);

  const [travelerName, setTravelerName] = useState<string>('Muskan');
  const [tripDestination, setTripDestination] = useState<string>('Goa');

  // Chat Agent State
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      sender: 'agent',
      text: "👋 Hi Muskan! Welcome to Wayzyy TripOS. Your living itinerary is active and synced with Superhosts Rahul & Priya. I use OpenStreetMap GIS spatial searching, live weather monitoring, and host recommendations to manage your trip. How can I assist you today?",
      tool: null,
    },
  ]);
  const [inputMsg, setInputMsg] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  const startVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Indian English — works great with Hindi accents too
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMsg(transcript);
      setIsListening(false);
      // Auto-send after 600ms so user can see what was captured
      setTimeout(() => handleSendMessage(transcript), 600);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  const fetchTrip = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getTrip('trip_1');
      setTripData(data);
    } catch (err) {
      console.error('Failed to load trip', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('wayzyy_user_name');
      const storedDest = localStorage.getItem('wayzyy_destination');
      if (storedName) {
        setTravelerName(storedName);
        setChatMessages([
          {
            sender: 'agent',
            text: `👋 Hi ${storedName}! Welcome to Wayzyy TripOS. Your living itinerary for **${storedDest || 'Goa'}** is active and synced with Superhosts Rahul & Priya. I use OpenStreetMap GIS spatial searching, live weather monitoring, and host recommendations to manage your trip. How can I assist you today?`,
            tool: null,
          },
        ]);
      }
      if (storedDest) {
        setTripDestination(storedDest);
      }
    }
    fetchTrip();
  }, []);

  // Handle Proactive Weather Incident Simulation
  const handleTriggerIncident = async () => {
    try {
      const res = await api.triggerIncident('trip_1', 'HEAVY_RAIN', activeDay, '02:00 PM');
      if (res.status === 'PROPOSAL_CREATED' && res.swapped_details?.length > 0) {
        await api.approveProposal(res.swapped_details[0].proposal_id, 'trip_1');
        res.auto_applied = true;
        setIncidentResult(res);
        setShowIncidentToast(true);
        fetchTrip(); // reload dashboard
      } else {
        setIncidentResult(res);
        setShowIncidentToast(true);
      }
    } catch (err) {
      console.error('Incident trigger failed', err);
    }
  };

  // Handle Schedule Conflict / Traffic Delay Simulation (d / speed calculation)
  const handleEvaluateDelay = async () => {
    try {
      // ⏱️ Dynamic delay based on time of day (not hardcoded 45)
      const now = new Date();
      const hourOfDay = now.getHours();
      const dynamicDelay = hourOfDay >= 17 ? 60 : hourOfDay >= 12 ? 45 : 20;

      // 🛰️ Real GPS — ask browser for actual device coordinates
      const getGPS = (): Promise<{ lat: number; lon: number }> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve({ lat: 15.5057, lon: 73.9269 }); // Panaji fallback
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => {
              console.warn('GPS denied — using destination fallback');
              resolve({ lat: 15.5057, lon: 73.9269 });
            },
            { timeout: 6000, maximumAge: 30000 }
          );
        });

      const { lat, lon } = await getGPS();
      console.log(`🛰️ GPS: ${lat}, ${lon} | ⏱️ Dynamic Delay: ${dynamicDelay} mins`);

      const res = await api.evaluateDelay('trip_1', activeDay, dynamicDelay, lat, lon, 25.0);

      if (res.status === 'CONFLICT_DETECTED' && res.proposal?.proposal_id) {
        await api.approveProposal(res.proposal.proposal_id, 'trip_1');
        res.auto_applied = true;
        setDelayResult(res);
        setShowDelayModal(true);
        fetchTrip();
      } else {
        setDelayResult(res);
        setShowDelayModal(true);
      }
    } catch (err) {
      console.error('Delay evaluation failed', err);
    }
  };

  // Accept Recovery Proposal
  const handleAcceptRecovery = async (proposalId?: string) => {
    try {
      const targetId = proposalId || (incidentResult?.swapped_details?.[0]?.proposal_id);
      if (targetId) {
        await api.approveProposal(targetId, 'trip_1');
      }
      setShowIncidentToast(false);
      setShowDelayModal(false);
      fetchTrip(); // Refresh itinerary & version logs!
    } catch (err) {
      console.error('Failed to approve proposal', err);
    }
  };

  // Handle Right Now context engine
  const handleFetchRightNow = async () => {
    try {
      const res = await api.getRightNow('trip_1', false);
      setRightNowCandidates(res.candidates || []);
      setShowRightNow(true);
    } catch (err) {
      console.error('Right now failed', err);
    }
  };

  // Handle Host tips
  const handleFetchHostTips = async () => {
    try {
      const res = await api.getHostTips('trip_1');
      setHostTips(res.host_tips || []);
      setShowHostTips(true);
    } catch (err) {
      console.error('Host tips failed', err);
    }
  };

  // Handle Chat submit
  const handleSendMessage = async (customMsg?: string) => {
    const msgToSend = customMsg || inputMsg;
    if (!msgToSend.trim()) return;

    const newUserMsg = { sender: 'user', text: msgToSend };
    setChatMessages((prev) => [...prev, newUserMsg]);
    if (!customMsg) setInputMsg('');
    setChatLoading(true);

    try {
      // Build conversation history for agent memory (last 10 messages, excluding welcome)
      const historyForApi = chatMessages
        .filter((m) => m.sender === 'user' || m.sender === 'agent')
        .slice(-10)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

      const res = await api.chatWithAgent(msgToSend, 'trip_1', tripDestination, historyForApi);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: res.reply,
          tool: res.tool_executed ? { name: res.tool_executed, args: res.tool_args } : null,
        },
      ]);
      fetchTrip(true); // Silent refresh if itinerary changed!
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: 'Error connecting to TripOS Agent.', tool: null },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading || !tripData) {
    return (
      <div className="min-h-screen bg-[#0b0b0c] text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#FF6B00] animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">Initializing Wayzyy TripOS Engine...</p>
        </div>
      </div>
    );
  }

  const { trip, preferences, itinerary_days, versions } = tripData;
  const timeOrder: Record<string, number> = { Morning: 1, Afternoon: 2, Evening: 3 };
  const rawItems = itinerary_days[activeDay] || [];
  const currentDayItems = [...rawItems].sort((a: any, b: any) => {
    const pA = timeOrder[a.time_period] || 4;
    const pB = timeOrder[b.time_period] || 4;
    return pA - pB;
  });

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-slate-100 font-sans selection:bg-[#FF6B00] selection:text-white">
      {/* Official Wayzyy Header Bar */}
      <header className="border-b border-white/10 bg-[#0b0b0c]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-[#FF6B00]/30 border border-orange-400/40">
                <span className="leading-none text-slate-950 font-black">W</span>
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-white font-display">Wayzyy <span className="text-[#FF6B00] font-medium">TripOS</span></span>
                <p className="text-[10px] text-slate-400 hidden sm:block">0% Commission · Direct Host Connection</p>
              </div>
            </Link>

            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#141518] text-slate-300 border border-white/10">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" /> {trip.destination || 'Goa'} (OSM GIS)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/30 hidden md:inline-flex">
              Version v{trip.current_version} ⚡ Living Plan
            </span>

            <GoogleTranslate />

            <Link
              href="/"
              className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" /> Create / Generate Trip
            </Link>

            <button
              onClick={() => setShowArchitecture(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-[#141518] hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center gap-1.5 shadow-sm hidden sm:flex"
            >
              <Cpu className="w-3.5 h-3.5 text-teal-400" /> Architecture Deep-Dive
            </button>

            {/* Notifications Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full bg-[#141518] hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center justify-center shadow-sm"
              >
                <Bell className="w-4 h-4 text-white" />
                {tripData.audit_actions?.length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#0b0b0c] animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-[#121316] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-white/10 bg-[#0b0b0c]/50 flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm">Trip Notifications</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00]">
                      {tripData.audit_actions?.length || 0} New
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {tripData.audit_actions?.length === 0 ? (
                      <p className="text-xs text-slate-500 p-4 text-center">No recent notifications.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {tripData.audit_actions?.map((action: any, idx: number) => (
                          <div key={idx} className="p-3.5 hover:bg-white/5 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#FF6B00]/10 flex items-center justify-center shrink-0">
                                {action.action === 'TRIP_INSIGHT' ? (
                                  <Cpu className="w-4 h-4 text-indigo-400" />
                                ) : (
                                  <Zap className="w-4 h-4 text-[#FF6B00]" />
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-[#FF6B00] mb-0.5 block">
                                  {action.action.replace(/_/g, ' ')}
                                </span>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {action.reason}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Interactive Demo Control Bar */}
      <div className="bg-gradient-to-r from-[#121316] via-[#16181F] to-[#24130A] border-b border-white/10 py-3.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-[#FF6B00] uppercase tracking-wider">Demo Triggers:</span>
            <span className="text-xs text-slate-400">Click to test TripOS Engines live!</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTriggerIncident}
              className="px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <CloudRain className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> ⚡ Rain Incident (2 PM)
            </button>

            <button
              onClick={handleEvaluateDelay}
              className="px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Car className="w-3.5 h-3.5 text-indigo-400" /> 🚗 Traffic Delay 45m (d / speed Matrix)
            </button>

            <button
              onClick={handleFetchRightNow}
              className="px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" /> ✨ What to do right now?
            </button>

            <button
              onClick={handleFetchHostTips}
              className="px-3 py-1.5 rounded-full bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Home className="w-3.5 h-3.5 text-teal-400" /> 🏠 Direct Host Tips
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: Living Itinerary & Trip Status (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Trip Health / Status Widget */}
          <div className="bg-[#121316] border border-white/10 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="font-bold text-white text-base font-display">Trip Health & Constraints Index</h3>
              </div>
              <span className="text-sm font-extrabold px-3 py-0.5 rounded-full bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30">
                {trip.health_score} / 100 · GOOD
              </span>
            </div>

            {/* Health Progress Gauge */}
            <div className="w-full h-3 bg-[#0b0b0c] rounded-full overflow-hidden mb-3.5 p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-[#FF6B00] rounded-full transition-all duration-500 shadow-lg shadow-[#FF6B00]/30"
                style={{ width: `${trip.health_score}%` }}
              />
            </div>

            {/* Constraint Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-[#0b0b0c] p-2.5 rounded-xl border border-white/10">
                <span className="text-slate-400 block mb-0.5">Quietness Preference</span>
                <span className="font-bold text-[#FF6B00]">{Math.round((preferences.quietness || 0.9) * 100)}% Quiet</span>
              </div>
              <div className="bg-[#0b0b0c] p-2.5 rounded-xl border border-white/10">
                <span className="text-slate-400 block mb-0.5">Budget Limit</span>
                <span className="font-bold text-slate-200">≤ ₹{preferences.budget_max}/act</span>
              </div>
              <div className="bg-[#0b0b0c] p-2.5 rounded-xl border border-white/10">
                <span className="text-slate-400 block mb-0.5">GIS Proximity</span>
                <span className="font-bold text-teal-400">OpenStreetMap Haversine</span>
              </div>
              <div className="bg-[#0b0b0c] p-2.5 rounded-xl border border-white/10">
                <span className="text-slate-400 block mb-0.5">Host Direct Link</span>
                <span className="font-bold text-emerald-400">Rahul & Priya (0% Fee)</span>
              </div>
            </div>
          </div>

          {/* TripOS Engine Insights (Dynamic Architecture Decisions) */}
          {tripData.audit_actions?.filter((a: any) => a.action === 'TRIP_INSIGHT').length > 0 && (
            <div className="bg-[#121316] border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm font-display">TripOS Optimizer Insights</h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {tripData.audit_actions.filter((a: any) => a.action === 'TRIP_INSIGHT').map((insight: any) => (
                  <div key={insight.id} className="bg-indigo-950/20 border border-indigo-500/20 p-3 rounded-xl flex items-start gap-3">
                    <span className="text-lg">🧠</span>
                    <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                      {insight.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Living Itinerary Timeline */}
          <div className="bg-[#121316] border border-white/10 rounded-2xl p-6 shadow-xl">

            {/* Day Selector Bar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
                  Living Itinerary <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20">Day {activeDay} of {Object.keys(itinerary_days).length}</span>
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">Others generate static plans. Wayzyy keeps your trip working when reality changes.</p>
              </div>

              <div className="flex gap-1.5 bg-[#0b0b0c] p-1 rounded-xl border border-white/10">
                {Object.keys(itinerary_days).map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDay(Number(d))}
                    className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                      activeDay === Number(d)
                        ? 'bg-[#FF6B00] text-white shadow-md shadow-[#FF6B00]/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline List */}
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-white/10">
              {currentDayItems.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No activities scheduled for Day {activeDay}.</p>
              ) : (
                currentDayItems.map((item: any, idx: number) => {
                  const isRecovered = item.status === 'RECOVERED';
                  const isAddedByAgent = item.status === 'ADDED_BY_AGENT' || item.status === 'MODIFIED_BY_AGENT';
                  const place = item.place;

                  return (
                    <div key={item.item_id || idx} className="relative pl-8 group">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute left-1.5 top-3.5 w-4 h-4 rounded-full border-2 -translate-x-1/2 flex items-center justify-center ${
                          isRecovered
                            ? 'bg-rose-500 border-rose-300 animate-pulse'
                            : isAddedByAgent
                            ? 'bg-amber-500 border-amber-300'
                            : 'bg-[#FF6B00] border-orange-300'
                        }`}
                      />

                      {/* Activity Card */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        isRecovered
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-[#0b0b0c] border-white/10 hover:border-[#FF6B00]/40'
                      }`}>
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#FF6B00] flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {item.time_slot}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">({item.time_period})</span>

                            {isRecovered && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> TripOS Plan B Swapped
                              </span>
                            )}

                            {isAddedByAgent && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Agent Modified
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            ₹{place.price} {place.price === 0 ? '(Free)' : ''}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2 font-display">
                          {place.name}
                          {place.indoor_flag ? (
                            <span className="text-[10px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                              100% Indoor
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Outdoor Shore
                            </span>
                          )}
                        </h4>

                        <p className="text-xs text-slate-400 mb-3">{place.description}</p>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                          <span className="flex items-center gap-1 flex-wrap">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" /> {place.area} · {place.category}
                            
                            {place.distance_km !== undefined && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold text-[10px] flex items-center gap-1">
                                🚗 {place.distance_km} km travel
                              </span>
                            )}
                            
                            {place.duration_hrs !== undefined && (
                              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold text-[10px] flex items-center gap-1">
                                ⏱️ {place.duration_hrs} hr duration
                              </span>
                            )}
                          </span>
                          <span className="text-[#FF6B00] font-bold">⭐ {place.rating} · Crowd: {place.crowd_level}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Version log & Attribution footer */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00]" /> Latest Version Change: {versions[0]?.change_description || 'Initial Plan'}
              </span>
              <span className="text-[10px] text-slate-500">
                Geospatial data © OpenStreetMap contributors (ODbL)
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Tool-Calling AI Agent (5 cols) */}
        <div className="lg:col-span-5 space-y-6">

          <div className="bg-[#121316] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col h-[650px]">
            {/* Agent Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center font-bold text-white shadow-lg shadow-[#FF6B00]/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-1.5 font-display">
                    Wayzyy AI Agent <CheckCircle2 className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]/20" />
                  </h3>
                  <p className="text-xs text-slate-400">Tool-Calling & GIS Spatial Intelligence</p>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20 uppercase tracking-wide">
                Executable Agent
              </span>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 mb-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#FF6B00] text-white font-bold rounded-br-none shadow-md'
                        : 'bg-[#0b0b0c] border border-white/10 text-slate-200 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Tool Execution Audit Log Badge */}
                  {msg.tool && (
                    <div className="mt-1.5 text-[10px] font-mono bg-[#0b0b0c] text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-md flex items-center gap-1 shadow-inner">
                      <Zap className="w-3 h-3 text-amber-400" />
                      TOOL EXECUTED: <span className="font-bold">{msg.tool.name}()</span>
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#0b0b0c] p-3 rounded-xl border border-white/10 w-max">
                  <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00] animate-spin" /> Agent executing tool calls...
                </div>
              )}
            </div>

            {/* Prompt Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar text-xs">
              <button
                onClick={() => handleSendMessage('Search seafood spots within 5 km')}
                className="px-2.5 py-1 rounded-lg bg-[#0b0b0c] hover:bg-white/5 text-slate-300 border border-white/10 whitespace-nowrap text-[11px]"
              >
                📍 GIS Search within 5 km
              </button>
              <button
                onClick={() => handleSendMessage('Will it rain tomorrow in Baga?')}
                className="px-2.5 py-1 rounded-lg bg-[#0b0b0c] hover:bg-white/5 text-slate-300 border border-white/10 whitespace-nowrap text-[11px]"
              >
                🌧️ Weather Check
              </button>
              <button
                onClick={() => handleSendMessage('Ask host for local tips')}
                className="px-2.5 py-1 rounded-lg bg-[#0b0b0c] hover:bg-white/5 text-slate-300 border border-white/10 whitespace-nowrap text-[11px]"
              >
                🏠 Host tips
              </button>
            </div>

            {/* Input Bar */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isListening ? '🎙️ Listening...' : 'Ask agent to search places or modify itinerary...'}
                  className={`w-full bg-[#0b0b0c] border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                    isListening
                      ? 'border-rose-500 placeholder-rose-400 animate-pulse'
                      : 'border-white/10 focus:border-[#FF6B00]'
                  }`}
                />
              </div>

              {/* Mic Button */}
              <button
                onClick={startVoiceInput}
                disabled={isListening}
                title="Voice input (speaks in Indian English)"
                className={`p-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30 cursor-not-allowed'
                    : 'bg-[#141518] border border-white/10 text-slate-300 hover:text-white hover:border-white/30'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send Button */}
              <button
                onClick={() => handleSendMessage()}
                className="px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold transition-all shadow-md shadow-[#FF6B00]/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: ⚡ Weather Recovery Proposal Modal */}
      {showIncidentToast && incidentResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-rose-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                  <CloudRain className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">⚡ TripOS Weather Recovery Proposal</h3>
                  <p className="text-xs text-rose-300">Proactive Disruption Alert (Rain Forecast)</p>
                </div>
              </div>
              <button
                onClick={() => setShowIncidentToast(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0b0b0c] p-4 rounded-xl border border-white/10 mb-5 space-y-3">
              <h4 className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">Why is TripOS recommending this recovery?</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {incidentResult.why_audit}
              </p>

              {incidentResult.swapped_details && incidentResult.swapped_details.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 block">Proposed Activity Swap:</span>
                  {incidentResult.swapped_details.map((swap: any, idx: number) => (
                    <div key={idx} className="text-xs bg-[#121316] p-3 rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="line-through text-slate-500 block text-[11px]">{swap.original_place}</span>
                        <span className="font-bold text-[#FF6B00] flex items-center gap-1 mt-0.5">
                          → {swap.new_place} ({swap.new_place_area})
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/20 font-extrabold">
                        Plan B Replacement
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {incidentResult.auto_applied ? (
                <button
                  onClick={() => setShowIncidentToast(false)}
                  className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-rose-500 hover:from-[#e66000] hover:to-rose-600 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white" /> Got it! Itinerary updated
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleAcceptRecovery()}
                    className="flex-1 py-3.5 rounded-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-[#FF6B00]/25 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-white" /> Accept Recovery Proposal
                  </button>
                  <button
                    onClick={() => setShowIncidentToast(false)}
                    className="px-5 py-3.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-white/10"
                  >
                    Keep Original
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: 🚗 Schedule Conflict & Traffic Delay Matrix Modal */}
      {showDelayModal && delayResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-indigo-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
                  <Car className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">🚗 Traffic Delay & Haversine Matrix</h3>
                  <p className="text-xs text-indigo-300">Proactive Schedule Conflict Resolution Engine</p>
                </div>
              </div>
              <button onClick={() => setShowDelayModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0b0b0c] p-4 rounded-xl border border-white/10 mb-5 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-[#121316] rounded-lg border border-white/5">
                  <span className="text-slate-400 text-[10px] block">Delay Lag</span>
                  <span className="font-extrabold text-amber-400">{delayResult.delay_minutes} mins</span>
                </div>
                <div className="p-2 bg-[#121316] rounded-lg border border-white/5">
                  <span className="text-slate-400 text-[10px] block">GIS Distance</span>
                  <span className="font-extrabold text-teal-400">{delayResult.distance_km} km</span>
                </div>
                <div className="p-2 bg-[#121316] rounded-lg border border-white/5">
                  <span className="text-slate-400 text-[10px] block">Travel Time</span>
                  <span className="font-extrabold text-indigo-300">{delayResult.travel_time_min} mins</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-xs text-indigo-200">
                <span className="font-bold block mb-1">Haversine Traffic Equation (d / speed):</span>
                <span>Distance: {delayResult.distance_km} km · Est. Speed: 25 km/h · Total Schedule Delay Buffer Needed: <strong>{delayResult.total_buffer_needed_min} mins</strong></span>
              </div>

              {delayResult.proposal && (
                <div className="p-3 bg-[#121316] rounded-xl border border-white/10 text-xs text-slate-300">
                  <span className="font-bold text-[#FF6B00] block mb-1">Proposed Resolution:</span>
                  <p>{delayResult.proposal.reason}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {delayResult.auto_applied ? (
                <button
                  onClick={() => setShowDelayModal(false)}
                  className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-[#FF6B00] to-indigo-600 hover:from-[#e66000] hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white" /> Got it! Schedule adjusted
                </button>
              ) : delayResult.proposal ? (
                <button
                  onClick={() => handleAcceptRecovery(delayResult.proposal.proposal_id)}
                  className="flex-1 py-3.5 rounded-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-[#FF6B00]/25 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white" /> Accept Schedule Adjustment
                </button>
              ) : (
                <button
                  onClick={() => setShowDelayModal(false)}
                  className="flex-1 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider"
                >
                  Schedule On Track
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ✨ "What Should I Do Right Now?" Drawer */}
      {showRightNow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-white/10 rounded-3xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">✨ What should I do right now?</h3>
                  <p className="text-xs text-slate-400">Context: 4:47 PM · {trip?.destination || 'Goa'} · GIS Radius ≤ 15 km · Budget ≤ ₹{preferences?.budget_max || 2500}</p>
                </div>
              </div>
              <button onClick={() => setShowRightNow(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {rightNowCandidates.map((cand, idx) => (
                <div key={idx} className="bg-[#0b0b0c] p-4 rounded-xl border border-white/10 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-sm">{cand.place.name}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30">
                        {cand.match_percentage}% Match
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{cand.place.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {cand.reasons.map((r: string, rIdx: number) => (
                        <span key={rIdx} className="text-[10px] px-2 py-0.5 rounded bg-[#121316] text-slate-300 border border-white/10">
                          {r}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-teal-400 font-semibold block">
                      Dataset: {cand.dataset_source || 'HuggingFace / Kaggle'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      handleSendMessage(`Add ${cand.place.name} to my itinerary`);
                      setShowRightNow(false);
                    }}
                    className="px-3.5 py-2 rounded-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold text-xs whitespace-nowrap shadow-md shadow-[#FF6B00]/20"
                  >
                    + Add to Trip
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Direct Host Recommendations */}
      {showHostTips && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-teal-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Direct Host Recommendations</h3>
                  <p className="text-xs text-teal-300">100% Direct Connection with Superhosts Rahul & Priya</p>
                </div>
              </div>
              <button onClick={() => setShowHostTips(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {hostTips.map((tip, idx) => (
                <div key={idx} className="bg-[#0b0b0c] p-4 rounded-xl border border-white/10">
                  <h4 className="text-xs font-bold text-[#FF6B00] mb-1">🏠 Host Recommended: {tip.place.name}</h4>
                  <p className="text-xs text-slate-200 italic mb-2">"{tip.quote}"</p>
                  <span className="text-[10px] text-slate-500 block">Superhosts: {tip.host_name} ({tip.property})</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowHostTips(false)}
              className="w-full py-2.5 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
            >
              Close Host Tips
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: Recruiter Architecture Diagram */}
      {showArchitecture && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-white/10 rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Cpu className="w-6 h-6 text-teal-400" />
                <div>
                  <h3 className="text-lg font-bold text-white font-display">Wayzyy TripOS System Architecture</h3>
                  <p className="text-xs text-slate-400">Recruiter Deep-Dive Engineering Map</p>
                </div>
              </div>
              <button onClick={() => setShowArchitecture(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-[#0b0b0c] p-4 rounded-xl border border-white/10 font-mono text-[11px] leading-relaxed text-teal-300 space-y-2">
                <p className="font-bold text-white mb-2">Architectural Flow & Separation:</p>
                <p>1. User Request → Multi-LLM Agent (Groq / Gemini reasoning & Tool selection)</p>
                <p>2. RAG Retrieval Service → TF-IDF & Cosine Similarity search over local guide documents</p>
                <p>3. Weather Service → Live Open-Meteo REST API forecasts</p>
                <p>4. Traffic & Schedule Engine → Haversine distance matrix calculations (d / speed)</p>
                <p>5. Layer 1 (GIS Spatial Engine) → OpenStreetMap lat/lon coordinates</p>
                <p>6. Layer 2 (Normalized Candidates) → HuggingFace (RoneyDsilva/goa-places) & Kaggle Datasets</p>
                <p>7. 5-Factor Ranking Engine → Score = 0.25 Pref + 0.25 Weather + 0.20 Budget + 0.15 Rating + 0.15 Proximity</p>
                <p>8. State Validation & State Commit → SQLite DB Transaction with Optimistic Concurrency versioning (trip_versions)</p>
              </div>

              <div className="p-3.5 bg-[#0b0b0c] rounded-xl border border-white/10">
                <h4 className="font-bold text-white mb-1">Golden Recruiter Line:</h4>
                <p className="text-slate-400 leading-normal">
                  "The LLM handles intent understanding and tool orchestration. Deterministic business logic handles spatial calculations, constraint scoring, and auditable state mutations."
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
