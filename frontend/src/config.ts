// Backend API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// Metered TURN Server API configuration
export const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY;
export const METERED_API_URL = `https://linkup-ufazien.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;

// Function to fetch TURN server credentials
export const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  try {
    const response = await fetch(METERED_API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch TURN credentials');
    }
    const iceServers = await response.json();
    return iceServers;
  } catch (error) {
    console.error('Error fetching ICE servers:', error);
    // Fallback to Google STUN servers if Metered API fails
    return [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ];
  }
};

// Default RTC configuration (will be updated with fetched credentials)
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ]
};


