import { useRef, useCallback, useState } from 'react';
import { RTC_CONFIG } from '../config';

export interface PeerConnection {
  peerConnection: RTCPeerConnection;
  clientId: string;
  stream?: MediaStream;
}

export interface UseWebRTCOptions {
  onIceCandidate?: (clientId: string, candidate: RTCIceCandidate) => void;
}

export const useWebRTC = (options?: UseWebRTCOptions) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const initializeLocalStream = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      return false;
    }
  }, []);

  const createPeerConnection = useCallback((clientId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    
    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', clientId);
      if (event.streams && event.streams[0]) {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(clientId, event.streams[0]);
          return newMap;
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && options?.onIceCandidate) {
        options.onIceCandidate(clientId, event.candidate);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${clientId}:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(clientId);
          return newMap;
        });
        peerConnectionsRef.current.delete(clientId);
      }
    };

    peerConnectionsRef.current.set(clientId, pc);
    return pc;
  }, []);

  const createOffer = useCallback(async (clientId: string): Promise<RTCSessionDescriptionInit | null> => {
    const pc = createPeerConnection(clientId);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }, [createPeerConnection]);

  const handleOffer = useCallback(async (clientId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
    const pc = createPeerConnection(clientId);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      return null;
    }
  }, [createPeerConnection]);

  const handleAnswer = useCallback(async (clientId: string, answer: RTCSessionDescriptionInit): Promise<void> => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (!pc) {
      console.error('No peer connection found for:', clientId);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (clientId: string, candidate: RTCIceCandidateInit): Promise<void> => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (!pc) {
      console.error('No peer connection found for:', clientId);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }, []);

  const removePeer = useCallback((clientId: string) => {
    const pc = peerConnectionsRef.current.get(clientId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(clientId);
    }
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(clientId);
      return newMap;
    });
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }, []);

  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const cleanup = useCallback(() => {
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    
    // Stop local stream
    stopLocalStream();
    
    // Clear remote streams
    setRemoteStreams(new Map());
  }, [stopLocalStream]);

  const hasPeerConnection = useCallback((clientId: string): boolean => {
    return peerConnectionsRef.current.has(clientId);
  }, []);

  return {
    localStream,
    remoteStreams,
    initializeLocalStream,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    toggleAudio,
    toggleVideo,
    stopLocalStream,
    cleanup,
    hasPeerConnection,
  };
};


