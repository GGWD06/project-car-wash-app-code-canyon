import * as Location from 'expo-location';

const API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export const getWeatherEmoji = (main) => {
  switch (main?.toLowerCase()) {
    case 'clear': return '☀️';
    case 'clouds': return '☁️';
    case 'rain': return '🌧️';
    case 'drizzle': return '🌦️';
    case 'thunderstorm': return '⛈️';
    case 'snow': return '❄️';
    default: return '🌡️';
  }
};

export const fetchWeatherByCoords = async (lat, lon) => {
  try {
    const response = await fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch current weather error:", error);
    return null;
  }
};

export const fetchForecastByCoords = async (lat, lon) => {
  try {
    const response = await fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch forecast error:", error);
    return null;
  }
};

export const getUserLocation = async () => {
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { city: 'Kuala Lumpur', coords: { latitude: 3.139, longitude: 101.6869 } }; // Default
    }

    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      console.warn("Location services are disabled, using fallback.");
      return { city: 'Kuala Lumpur', coords: { latitude: 3.139, longitude: 101.6869 } };
    }

    let location = await Location.getCurrentPositionAsync({});
    const reverseGeocode = await Location.reverseGeocodeAsync(location.coords);
    
    return {
      city: reverseGeocode[0]?.city || reverseGeocode[0]?.region || 'Unknown Location',
      coords: location.coords
    };
  } catch (error) {
    console.warn("Get location error (using fallback):", error.message);
    // Return a fallback location so the app doesn't crash or show empty weather
    return { city: 'Kuala Lumpur', coords: { latitude: 3.139, longitude: 101.6869 } };
  }
};
