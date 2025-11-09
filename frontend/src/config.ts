// Backend API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// WebRTC Configuration with STUN and TURN servers
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.relay.metered.ca:80'
    },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: '81df41330ffff0c3d75e77ed',
      credential: 'yn1jtZhMFeVgGmYo'
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: '81df41330ffff0c3d75e77ed',
      credential: 'yn1jtZhMFeVgGmYo'
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: '81df41330ffff0c3d75e77ed',
      credential: 'yn1jtZhMFeVgGmYo'
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: '81df41330ffff0c3d75e77ed',
      credential: 'yn1jtZhMFeVgGmYo'
    }
  ]
};


