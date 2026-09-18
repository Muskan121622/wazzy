import requests
from services.gis import resolve_location_coordinates

def get_live_weather(area="Baga", lat=None, lon=None):
    """
    Fetches real-time weather from Open-Meteo API for given area or lat/lon.
    Returns structured temperature, condition, rain probability, and proactive advisory.
    """
    coord_info = resolve_location_coordinates(area)
    if lat is None or lon is None:
        lat, lon = coord_info["lat"], coord_info["lon"]

    clean_area = coord_info.get("clean_name", area)
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=precipitation_probability,rain"
    
    try:
        response = requests.get(url, timeout=4)
        response.raise_for_status()
        data = response.json()
        
        current = data.get("current_weather", {})
        temp = current.get("temperature", 29.0)
        weathercode = current.get("weathercode", 0)

        # Check hourly max rain probability
        hourly_rain = data.get("hourly", {}).get("precipitation_probability", [0])
        max_rain_prob = max(hourly_rain[:12]) if hourly_rain else 15

        is_rainy = weathercode in [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99] or max_rain_prob > 50

        if is_rainy:
            condition = "Rain / Monsoonal Showers"
            rain_prob_str = f"{max_rain_prob}%"
            advisory = f"🌧️ High rain probability in {clean_area}. Wayzyy auto-recommends indoor dining or heritage museum tours."
        else:
            condition = "Clear Sky & Sunny"
            rain_prob_str = f"{max_rain_prob}%"
            advisory = f"☀️ Perfect weather in {clean_area}! Great time for outdoor coastal exploration."

        return {
            "area": clean_area,
            "temperature_c": temp,
            "condition": condition,
            "rain_probability": rain_prob_str,
            "is_rainy": is_rainy,
            "recommended_action": advisory,
            "source": "Open-Meteo Live API"
        }
    except Exception as e:
        print(f"Open-Meteo fetch notice ({e}), using fallback weather baseline for {clean_area}")
        return {
            "area": clean_area,
            "temperature_c": 28.5,
            "condition": "Cloudy with afternoon showers expected",
            "rain_probability": "70%",
            "is_rainy": True,
            "recommended_action": f"🌧️ High rain probability. Opt for indoor dining or museums during 2 PM - 5 PM in {clean_area}.",
            "source": "Goa Seasonal Baseline"
        }

if __name__ == "__main__":
    res = get_live_weather("Ponda, South Goa")
    print("Ponda Weather:", res)
