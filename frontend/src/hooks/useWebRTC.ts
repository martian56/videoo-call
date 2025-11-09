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
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

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
    // If we're screen sharing, use the screen track, otherwise use camera
    const streamToUse = screenStreamRef.current && isScreenSharing 
      ? screenStreamRef.current 
      : localStreamRef.current;
    
    if (streamToUse) {
      console.log('Adding local tracks to peer connection for:', clientId, 'screen sharing:', isScreenSharing);
      streamToUse.getTracks().forEach((track) => {
        pc.addTrack(track, streamToUse);
      });
      
      // If we're using screen stream, also add audio from original stream
      if (screenStreamRef.current && isScreenSharing && localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, localStreamRef.current);
        }
      }
    } else {
      console.warn('No local stream available when creating peer connection for:', clientId);
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', clientId, {
        trackId: event.track.id,
        trackKind: event.track.kind,
        trackLabel: event.track.label,
        streamsCount: event.streams.length
      });
      
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        
        if (event.streams && event.streams[0]) {
          // Use the stream from the event
          const stream = event.streams[0];
          // Create a new stream object to force React update
          const newStream = new MediaStream(stream.getTracks());
          newMap.set(clientId, newStream);
          console.log('Updated remote stream for', clientId, 'tracks:', newStream.getTracks().map(t => ({ id: t.id, kind: t.kind, label: t.label, enabled: t.enabled })));
        } else if (event.track) {
          // If no stream, create one from the track
          const existingStream = prev.get(clientId);
          if (existingStream) {
            // Add the new track to existing stream or create new one
            const newStream = new MediaStream([...existingStream.getTracks(), event.track]);
            newMap.set(clientId, newStream);
          } else {
            const newStream = new MediaStream([event.track]);
            newMap.set(clientId, newStream);
          }
          console.log('Created/updated stream from track for', clientId);
        }
        
        return newMap;
      });
      
      // Listen for track ending to update stream
      event.track.onended = () => {
        console.log('Remote track ended for', clientId);
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          const stream = newMap.get(clientId);
          if (stream) {
            // Remove ended track and create new stream
            const activeTracks = stream.getTracks().filter(t => t.readyState !== 'ended');
            if (activeTracks.length > 0) {
              newMap.set(clientId, new MediaStream(activeTracks));
            } else {
              newMap.delete(clientId);
            }
          }
          return newMap;
        });
      };
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && options?.onIceCandidate) {
        options.onIceCandidate(clientId, event.candidate);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Connection state with ${clientId}:`, state);
      
      if (state === 'disconnected' || state === 'failed') {
        console.warn(`Connection ${state} with ${clientId}, cleaning up`);
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(clientId);
          return newMap;
        });
        peerConnectionsRef.current.delete(clientId);
      } else if (state === 'connected') {
        console.log(`Successfully connected to ${clientId}`);
      }
    };
    
    // Handle ICE connection state changes for better debugging
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`ICE connection state with ${clientId}:`, iceState);
      
      if (iceState === 'failed') {
        console.error(`ICE connection failed with ${clientId}, may need to restart`);
      }
    };

    peerConnectionsRef.current.set(clientId, pc);
    return pc;
  }, [isScreenSharing, options]);

  const createOffer = useCallback(async (clientId: string): Promise<RTCSessionDescriptionInit | null> => {
    // Check if local stream is ready before creating offer
    const streamToUse = screenStreamRef.current && isScreenSharing 
      ? screenStreamRef.current 
      : localStreamRef.current;
    
    if (!streamToUse) {
      console.warn('Cannot create offer: local stream not ready for', clientId);
      return null;
    }
    
    const pc = createPeerConnection(clientId);
    
    // Double-check that tracks were added
    if (pc.getSenders().length === 0) {
      console.warn('Peer connection created without tracks, retrying...');
      // Try to add tracks again
      streamToUse.getTracks().forEach((track) => {
        pc.addTrack(track, streamToUse);
      });
      
      // If we're using screen stream, also add audio from original stream
      if (screenStreamRef.current && isScreenSharing && localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, localStreamRef.current);
        }
      }
    }
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('Created offer successfully for', clientId, 'with', pc.getSenders().length, 'senders');
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      // Clean up failed connection
      peerConnectionsRef.current.delete(clientId);
      pc.close();
      return null;
    }
  }, [createPeerConnection, isScreenSharing]);

  const handleOffer = useCallback(async (clientId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> => {
    // Check if local stream is ready before handling offer
    const streamToUse = screenStreamRef.current && isScreenSharing 
      ? screenStreamRef.current 
      : localStreamRef.current;
    
    if (!streamToUse) {
      console.warn('Cannot handle offer: local stream not ready for', clientId);
      return null;
    }
    
    // Check if we already have a peer connection for this client
    let pc = peerConnectionsRef.current.get(clientId);
    if (!pc) {
      console.log('Creating new peer connection for offer from:', clientId);
      pc = createPeerConnection(clientId);
      
      if (!pc) {
        console.error('Failed to create peer connection for:', clientId);
        return null;
      }
      
      // Ensure tracks are added
      if (pc.getSenders().length === 0) {
        console.warn('Peer connection created without tracks, adding tracks...');
        streamToUse.getTracks().forEach((track) => {
          pc!.addTrack(track, streamToUse);
        });
        
        // If we're using screen stream, also add audio from original stream
        if (screenStreamRef.current && isScreenSharing && localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            pc!.addTrack(audioTrack, localStreamRef.current);
          }
        }
      }
    } else {
      console.log('Reusing existing peer connection for offer from:', clientId);
      // If remote description is already set, we might be handling a duplicate offer
      if (pc.remoteDescription) {
        console.warn('Remote description already set for:', clientId, 'current state:', pc.signalingState);
        // If we're in a state where we can set it again, continue, otherwise return
        if (pc.signalingState === 'stable') {
          // We can set it again
        } else {
          console.error('Cannot set remote description, signaling state:', pc.signalingState);
          return null;
        }
      }
    }
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Set remote description for:', clientId, 'signaling state:', pc.signalingState);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Created and set local answer for:', clientId, 'with', pc.getSenders().length, 'senders');
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error, 'signaling state:', pc?.signalingState);
      // Clean up failed connection
      peerConnectionsRef.current.delete(clientId);
      pc.close();
      return null;
    }
  }, [createPeerConnection, isScreenSharing]);

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

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      // Get screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true, // Try to capture system audio if available
      });

      screenStreamRef.current = screenStream;

      // Get the video track from screen stream
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (!screenVideoTrack) {
        throw new Error('No video track in screen stream');
      }

      // Store original camera stream if not already stored
      if (!localStreamRef.current) {
        throw new Error('No local stream available');
      }

      // Store the original camera video track before replacing
      const originalVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (originalVideoTrack && originalVideoTrack.label !== 'screen') {
        originalVideoTrackRef.current = originalVideoTrack;
      }

      // Replace video tracks in all peer connections
      const replacePromises: Promise<void>[] = [];
      peerConnectionsRef.current.forEach((pc, clientId) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((sender) => 
          sender.track && sender.track.kind === 'video'
        );

        if (videoSender && screenVideoTrack) {
          console.log(`Replacing video track for ${clientId} with screen track`);
          const replacePromise = videoSender.replaceTrack(screenVideoTrack).then(() => {
            console.log(`Successfully replaced track for ${clientId}`);
            // Ensure the track is enabled
            if (screenVideoTrack) {
              screenVideoTrack.enabled = true;
            }
          }).catch((error) => {
            console.error(`Error replacing track for ${clientId}:`, error);
          });
          replacePromises.push(replacePromise);
        } else {
          console.warn(`No video sender found for ${clientId} or no screen track`);
        }
      });

      // Wait for all track replacements to complete
      await Promise.all(replacePromises);

      // Update local stream to show screen share
      // Create a new stream with screen video and original audio
      const originalAudioTrack = localStreamRef.current.getAudioTracks()[0];
      const newStream = new MediaStream();
      if (screenVideoTrack) {
        newStream.addTrack(screenVideoTrack);
      }
      if (originalAudioTrack) {
        newStream.addTrack(originalAudioTrack);
      }

      setLocalStream(newStream);
      setIsScreenSharing(true);

      // Handle when user stops sharing via browser UI
      // We'll handle this in the component to avoid circular dependency

      console.log('Screen sharing started');
      return true;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    try {
      // Stop screen stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }

      // Restore original camera stream if available
      if (localStreamRef.current) {
        // Use stored original video track, or get a new one
        let videoTrack = originalVideoTrackRef.current;
        
        if (!videoTrack || videoTrack.readyState !== 'live') {
          // Re-get camera stream if original track is not available
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false, // Keep existing audio
          });
          videoTrack = cameraStream.getVideoTracks()[0];
        }
        
        originalVideoTrackRef.current = null;

        // Replace video tracks in all peer connections back to camera
        if (videoTrack) {
          peerConnectionsRef.current.forEach((pc, clientId) => {
            const senders = pc.getSenders();
            const videoSender = senders.find((sender) => 
              sender.track && sender.track.kind === 'video'
            );

            if (videoSender) {
              videoSender.replaceTrack(videoTrack!).catch((error) => {
                console.error(`Error replacing track back to camera for ${clientId}:`, error);
              });
            }
          });

          // Update local stream to show camera
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          const newStream = new MediaStream();
          newStream.addTrack(videoTrack);
          if (audioTrack) {
            newStream.addTrack(audioTrack);
          }
          setLocalStream(newStream);
        }
      }

      setIsScreenSharing(false);
      console.log('Screen sharing stopped');
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }, []);

  return {
    localStream,
    remoteStreams,
    isScreenSharing,
    initializeLocalStream,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    stopLocalStream,
    cleanup,
    hasPeerConnection,
  };
};


