'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, MapPin, Sparkles, Calendar, Users, ArrowRight, Percent, Sliders, CheckCircle, Loader2, Search, Key, IndianRupee, Navigation, Check } from 'lucide-react';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  // Form Fields
  const [userName, setUserName] = useState('Muskan');
  const [destination, setDestination] = useState('Agonda, Canacona, Goa');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>({ lat: 15.0441, lon: 73.9877 });

  // Real Calendar Date Pickers
  const [startDate, setStartDate] = useState('2026-09-20');
  const [endDate, setEndDate] = useState('2026-09-24');

  // Total Trip Budget
  const [totalBudget, setTotalBudget] = useState(15000);

  // Preference Controls
  const [quietness, setQuietness] = useState(0.85);
  const [seafood, setSeafood] = useState(0.1);
  const [crowdTolerance, setCrowdTolerance] = useState(0.2);
  const [energyLevel, setEnergyLevel] = useState('medium');

  // Live Location Search State
  const [locationQuery, setLocationQuery] = useState('Agonda, Canacona, Goa');
  const [liveSuggestions, setLiveSuggestions] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  // Optional API Key for Google / Mapbox
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Animated Multi-Step Stepper Loading State
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSteps = [
    "Filtering GIS spatial radius & OpenStreetMap coordinates...",
    "Checking Open-Meteo live weather forecasts...",
    "Querying RAG Knowledge Base for authentic local host tips...",
    "Balancing budget across daily spending caps...",
    "Building dynamic Living Itinerary in SQLite..."
  ];

  // Compute Days Count from Calendar Inputs
  const daysCount = useMemo(() => {
    try {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Reverted to standard check-in/out night calculation
      return Math.max(1, diffDays);
    } catch {
      return 4;
    }
  }, [startDate, endDate]);

  // Daily budget allocation calculation
  const dailyBudget = useMemo(() => {
    return Math.round(totalBudget / Math.max(1, daysCount));
  }, [totalBudget, daysCount]);

  const maxActivityBudget = useMemo(() => {
    return Math.round(dailyBudget * 0.6);
  }, [dailyBudget]);

  // Handle GPS Device Location Button
  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setSelectedCoords({ lat, lon });

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          const placeName = data.display_name || `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
          setLocationQuery(placeName);
          setDestination(placeName);
        } catch {
          setLocationQuery(`Current Location (${lat.toFixed(3)}, ${lon.toFixed(3)})`);
          setDestination(`Current Location (${lat.toFixed(3)}, ${lon.toFixed(3)})`);
        } finally {
          setIsGettingGps(false);
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        setIsGettingGps(false);
        alert("Could not fetch device location. Please type manually.");
      },
      { timeout: 8000 }
    );
  };

  // Live Location Search via OpenStreetMap Nominatim API (with Google Places API support)
  useEffect(() => {
    if (!locationQuery || locationQuery.length < 2) {
      setLiveSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        if (apiKey.trim()) {
          if (apiKey.startsWith('pk.')) {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationQuery)}.json?access_token=${apiKey}&limit=5`);
            const data = await res.json();
            if (data.features) {
              setLiveSuggestions(data.features.map((f: any) => ({
                display_name: f.place_name,
                name: f.text,
                lat: f.center[1],
                lon: f.center[0]
              })));
            }
          } else {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=5`, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'Wayzyy-TripOS/1.0' }
            });
            const data = await res.json();
            setLiveSuggestions(data || []);
          }
        } else {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=6&addressdetails=1`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Wayzyy-TripOS/1.0' }
          });
          const data = await res.json();
          setLiveSuggestions(data || []);
        }
      } catch (err) {
        console.error('Live location fetch error:', err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [locationQuery, apiKey]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingStep(0);

    try {
      // Start API call in background promise
      const apiPromise = api.generateTrip({
        user_name: userName,
        destination,
        days_count: daysCount,
        quietness: Number(quietness),
        seafood: Number(seafood),
        total_budget: Number(totalBudget),
        budget_max: Number(maxActivityBudget),
        crowd_tolerance: Number(crowdTolerance),
        energy_level: energyLevel,
        start_date: startDate,
        end_date: endDate,
        dest_lat: selectedCoords?.lat,
        dest_lon: selectedCoords?.lon
      });

      // Smooth step-by-step visual animation for the user
      for (let step = 0; step < loadingSteps.length; step++) {
        setLoadingStep(step);
        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      const res = await apiPromise;

      if (typeof window !== 'undefined') {
        localStorage.setItem('wayzyy_user_name', userName);
        localStorage.setItem('wayzyy_destination', destination);
        localStorage.setItem('wayzyy_total_budget', totalBudget.toString());
      }

      router.push(`/concierge?user_name=${encodeURIComponent(userName)}`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate trip. Please make sure backend server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-slate-100 font-sans selection:bg-[#FF6B00] selection:text-white relative">

      {/* Animated Multi-Step Stepper Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#0b0b0c]/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-[#121316] border border-[#FF6B00]/40 rounded-3xl p-8 max-w-lg w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B00]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="w-16 h-16 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/30 mx-auto flex items-center justify-center text-[#FF6B00] mb-6">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <h3 className="text-xl font-extrabold text-white mb-2">Engine Computing TripOS Matrix</h3>
            <p className="text-xs text-slate-400 mb-6">Running 5-Factor Scoring, Haversine GIS distances & RAG lookup</p>

            <div className="space-y-3 text-left mb-6">
              {loadingSteps.map((stepText, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-semibold transition-all ${
                    idx < loadingStep
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : idx === loadingStep
                      ? 'bg-[#FF6B00]/10 border-[#FF6B00]/40 text-white animate-pulse'
                      : 'bg-[#141518] border-white/5 text-slate-500'
                  }`}
                >
                  {idx < loadingStep ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : idx === loadingStep ? (
                    <Loader2 className="w-4 h-4 text-[#FF6B00] animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span>{stepText}</span>
                </div>
              ))}
            </div>

            <span className="text-[11px] font-extrabold text-[#FF6B00] uppercase tracking-wider">
              Wayzyy Autonomous Engine Active
            </span>
          </div>
        </div>
      )}

      {/* Marquee Bar matching live Wayzyy site */}
      <div className="bg-[#141518] border-b border-white/10 overflow-hidden py-2 text-[11px] uppercase tracking-[0.2em] font-semibold text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap no-scrollbar">
            <span>0% Booking Commission</span> <span className="text-[#FF6B00]">✦</span>
            <span>Aadhaar Verified Identity</span> <span className="text-[#FF6B00]">✦</span>
            <span>100% Direct Host Connection</span> <span className="text-[#FF6B00]">✦</span>
            <span className="text-white">Wayzyy TripOS Active</span> <span className="text-[#FF6B00]">✦</span>
            <span>Honest Pricing</span>
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse"></span> Goa Homestays & Villas
          </span>
        </div>
      </div>

      {/* Official Wayzyy Header */}
      <header className="border-b border-white/10 bg-[#0b0b0c]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-[#FF6B00]/30 border border-orange-400/40">
              <span className="leading-none text-slate-950 font-black">W</span>
            </div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight text-white font-display">
                Wayzyy
              </span>
              <span className="ml-2.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/30 uppercase tracking-wide">
                TripOS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="px-3.5 py-2 text-xs font-bold rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-[#FF6B00]" />
              {apiKey ? 'API Key Active' : 'Custom API Key'}
            </button>

            <button
              onClick={() => router.push('/concierge')}
              className="px-5 py-2.5 text-xs font-extrabold rounded-full bg-white/10 hover:bg-white/20 text-white uppercase tracking-wider transition-all flex items-center gap-2 border border-white/10"
            >
              <Sparkles className="w-4 h-4 text-[#FF6B00]" />
              View Living Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* API Key Modal / Drawer */}
      {showApiKeyInput && (
        <div className="bg-[#141518] border-b border-[#FF6B00]/30 p-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#FF6B00]" />
              <span className="text-xs font-bold text-white">Google Places / Mapbox API Key Integration:</span>
              <span className="text-xs text-slate-400">Paste your API key below for custom places geocoding.</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste Google Places Key / Mapbox Token"
                className="px-3 py-1.5 rounded-lg bg-[#0b0b0c] border border-white/20 text-white text-xs w-72 focus:outline-none focus:border-[#FF6B00]"
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="px-3 py-1.5 rounded-lg bg-[#FF6B00] text-white font-bold text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-br from-[#121316] via-[#16181F] to-[#24130A] border border-white/15 rounded-3xl p-8 md:p-12 mb-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF6B00]/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="flex flex-wrap gap-2 items-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[#FF6B00] text-xs font-bold">
              <CheckCircle className="w-4 h-4 text-[#FF6B00]" /> Post-Booking Living Travel Engine
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold">
              <Percent className="w-3.5 h-3.5" /> 0% Commission · Direct Host
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4 max-w-4xl leading-tight font-display">
            Configure Your Stay & <br />
            <span className="text-[#FF6B00]">Generate Your Living Itinerary</span>
          </h1>

          <p className="text-slate-300 text-base md:text-lg max-w-3xl mb-8 leading-relaxed">
            Set your total trip budget and travel dates below. Our 5-factor scoring engine and OpenStreetMap GIS distance algorithm will dynamically construct your custom living itinerary in real-time.
          </p>

          {/* Interactive Form */}
          <form onSubmit={handleGenerate} className="bg-[#0b0b0c]/80 border border-white/15 rounded-2xl p-6 md:p-8 backdrop-blur shadow-2xl">
            
            <div className="grid md:grid-cols-4 gap-6 mb-6">
              {/* Traveler Name */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">Traveler Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#141518] border border-white/10 text-white text-sm focus:outline-none focus:border-[#FF6B00]"
                  placeholder="Your Name"
                  required
                />
              </div>

              {/* Destination Stay with REAL Live Location Autocomplete + GPS Device Location Button */}
              <div className="relative" ref={locationRef}>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Destination Stay
                  </label>
                  <button
                    type="button"
                    onClick={handleUseDeviceLocation}
                    disabled={isGettingGps}
                    className="text-[10px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1"
                  >
                    {isGettingGps ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Navigation className="w-3 h-3" />
                    )}
                    GPS Location
                  </button>
                </div>

                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={(e) => {
                      setLocationQuery(e.target.value);
                      setDestination(e.target.value);
                      setShowLocationDropdown(true);
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    className="w-full pl-10 pr-9 py-3 rounded-xl bg-[#141518] border border-white/10 text-white text-sm focus:outline-none focus:border-[#FF6B00]"
                    placeholder="Type any city or stay location..."
                    required
                  />
                  {isSearchingLocation && (
                    <Loader2 className="w-4 h-4 text-[#FF6B00] animate-spin absolute right-3 top-3.5" />
                  )}
                </div>

                {/* Live Location Suggestions Dropdown */}
                {showLocationDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[#121316] border border-white/15 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-white/5 backdrop-blur">
                    {isSearchingLocation ? (
                      <div className="p-4 text-xs text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-[#FF6B00] animate-spin" />
                        Fetching live coordinates...
                      </div>
                    ) : liveSuggestions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400">Type a location to see live suggestions</div>
                    ) : (
                      liveSuggestions.map((item: any, idx: number) => {
                        const name = item.display_name || item.name || 'Location';
                        const parts = name.split(',');
                        const title = parts[0];
                        const subtitle = parts.slice(1, 3).join(',');

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setLocationQuery(title);
                              setDestination(name);
                              if (item.lat && item.lon) {
                                setSelectedCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
                              }
                              setShowLocationDropdown(false);
                            }}
                            className="w-full p-3 text-left hover:bg-[#FF6B00]/10 transition-colors flex items-start gap-3 group"
                          >
                            <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                            <div>
                              <span className="text-xs font-bold text-white block">{title}</span>
                              <span className="text-[11px] text-slate-400 block line-clamp-1">{subtitle || name}</span>
                              {item.lat && (
                                <span className="text-[10px] text-teal-400 block font-mono mt-0.5">
                                  GIS: {Number(item.lat).toFixed(4)}°N, {Number(item.lon).toFixed(4)}°E
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Real Check-in Date Calendar */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">Check-in Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-[#141518] border border-white/10 text-white text-sm focus:outline-none focus:border-[#FF6B00] scheme-dark"
                    required
                  />
                </div>
              </div>

              {/* Real Check-out Date Calendar */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">Check-out Date</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-[#141518] border border-white/10 text-white text-sm focus:outline-none focus:border-[#FF6B00] scheme-dark"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Smart Budget & Duration Summary Cards */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8 p-4 rounded-xl bg-[#141518] border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF6B00]">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold uppercase">Trip Duration</span>
                  <span className="text-sm font-extrabold text-white">{daysCount} Days ({startDate} to {endDate})</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold uppercase">Daily Budget Cap</span>
                  <span className="text-sm font-extrabold text-emerald-400">₹{dailyBudget.toLocaleString()} / day</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold uppercase">Max Per Activity</span>
                  <span className="text-sm font-extrabold text-amber-300">≤ ₹{maxActivityBudget.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Preferences Sliders & Total Budget */}
            <div className="border-t border-white/10 pt-6 mb-8">
              <h3 className="text-sm font-extrabold text-[#FF6B00] uppercase tracking-wider mb-6 flex items-center gap-2">
                <Sliders className="w-4 h-4" /> Trip DNA & Budget Optimization Parameters
              </h3>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Total Trip Budget Input */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-300">Total Trip Budget</span>
                    <div className="relative flex items-center">
                      <span className="text-xs font-extrabold text-emerald-400 absolute left-2.5">₹</span>
                      <input
                        type="number"
                        min="500"
                        max="200000"
                        step="500"
                        value={totalBudget}
                        onChange={(e) => setTotalBudget(Math.max(0, Number(e.target.value)))}
                        className="w-32 pl-6 pr-2 py-1 rounded-lg bg-[#141518] border border-emerald-500/40 text-emerald-400 font-extrabold text-xs focus:outline-none focus:border-[#FF6B00] shadow-sm"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="500"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(Number(e.target.value))}
                    className="w-full accent-[#FF6B00] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Smart engine calculates daily spending caps (~₹{dailyBudget.toLocaleString()} / day) so your itinerary stays within your total budget limit.</p>
                </div>

                {/* Quietness Preference */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-300">Quietness Preference</span>
                    <span className="text-xs font-extrabold text-[#FF6B00] bg-[#FF6B00]/10 px-2.5 py-0.5 rounded border border-[#FF6B00]/30">
                      {Math.round(quietness * 100)}% Quiet & Low Crowd
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={quietness}
                    onChange={(e) => setQuietness(Number(e.target.value))}
                    className="w-full accent-[#FF6B00] cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Higher quietness prioritizes calm coves, heritage villas & low-crowd cafes.</p>
                </div>

                {/* Seafood Preference */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-300">Seafood & Coastal Food Priority</span>
                    <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                      {Math.round(seafood * 100)}% Priority
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={seafood}
                    onChange={(e) => setSeafood(Number(e.target.value))}
                    className="w-full accent-[#FF6B00] cursor-pointer"
                  />
                </div>

                {/* Energy Level */}
                <div>
                  <span className="text-xs font-bold text-slate-300 block mb-2">Pacing & Energy Level</span>
                  <div className="grid grid-cols-3 gap-3">
                    {['relaxed', 'medium', 'high'].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setEnergyLevel(lvl)}
                        className={`py-2 text-xs font-bold rounded-lg border capitalize transition-all ${
                          energyLevel === lvl
                            ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-md shadow-[#FF6B00]/30'
                            : 'bg-[#141518] text-slate-400 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-extrabold text-xs uppercase tracking-widest transition-all shadow-xl shadow-[#FF6B00]/30 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running 5-Factor Scoring & Budget Optimization Engine...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Custom Living Itinerary
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
