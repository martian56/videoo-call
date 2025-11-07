// Backend API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL 
export const WS_BASE_URL = import.meta.env.VITE_WS_URL

// WebRTC Configuration with Google STUN servers
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ]
    }
  ]
};


