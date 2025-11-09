import { useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Pin, PinOff } from 'lucide-react';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Map<string, { displayName?: string; audioEnabled?: boolean; videoEnabled?: boolean; screenSharing?: boolean }>;
  localClientId: string;
  pinnedClientId: string | null;
  onPin: (clientId: string | null) => void;
}

export default function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  localClientId,
  pinnedClientId,
  onPin,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRefs = useRef<Set<HTMLVideoElement>>(new Set());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Update all local video streams
  useEffect(() => {
    if (localStream) {
      // Update the main ref
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
      // Update all tracked local video elements
      localVideoRefs.current.forEach((videoEl) => {
        if (videoEl && videoEl.srcObject !== localStream) {
          videoEl.srcObject = localStream;
        }
      });
    }
  }, [localStream]);

  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];
    
    remoteStreams.forEach((stream, clientId) => {
      // CRITICAL: Skip the pinned video - it manages its own stream assignment
      if (pinnedClientId === clientId) {
        return;
      }
      
      const videoRef = remoteVideoRefs.current.get(clientId);
      if (videoRef && stream) {
        // Force update by clearing and resetting
        if (videoRef.srcObject !== stream) {
          videoRef.srcObject = null;
          videoRef.srcObject = stream;
        } else {
          // Even if it's the same stream, the tracks might have changed
          // Force a reload by temporarily clearing
          videoRef.srcObject = null;
          setTimeout(() => {
            if (videoRef) {
              videoRef.srcObject = stream;
            }
          }, 0);
        }
        
        // Listen for track changes
        const handleTrackChange = () => {
          if (videoRef && videoRef.srcObject !== stream) {
            videoRef.srcObject = stream;
          }
        };
        
        stream.getTracks().forEach(track => {
          track.addEventListener('ended', handleTrackChange);
          track.addEventListener('mute', handleTrackChange);
          track.addEventListener('unmute', handleTrackChange);
        });
        
        cleanupFunctions.push(() => {
          stream.getTracks().forEach(track => {
            track.removeEventListener('ended', handleTrackChange);
            track.removeEventListener('mute', handleTrackChange);
            track.removeEventListener('unmute', handleTrackChange);
          });
        });
      } else if (!videoRef && stream) {
        // Stream arrived but video element doesn't exist yet
        // This can happen for pinned videos - the ref will be set when the component renders
        console.log('Stream arrived for', clientId, 'but video ref not ready yet');
      }
    });
    
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [remoteStreams, pinnedClientId]);

  const getParticipantInfo = (clientId: string) => {
    return participants.get(clientId) || {};
  };

  // Separate pinned and unpinned videos
  // Always include local video, even if stream isn't ready yet
  const allVideos = [
    { clientId: localClientId, isLocal: true, stream: localStream },
    ...Array.from(remoteStreams.entries()).map(([clientId, stream]) => ({
      clientId,
      isLocal: false,
      stream,
    })),
  ];

  // Find pinned video - check if it exists in allVideos or if it's the local client
  // This handles cases where the stream might not be ready yet
  // For remote participants, we can still pin them even if stream isn't ready
  // But we need to check remoteStreams directly to get the latest stream
  const pinnedVideo = pinnedClientId 
    ? (() => {
        // If it's the local client, create the object
        if (pinnedClientId === localClientId) {
          return { clientId: localClientId, isLocal: true, stream: localStream };
        }
        
        // For remote participants, ALWAYS get stream directly from remoteStreams
        // This ensures we get the correct stream for the correct clientId
        const remoteStream = remoteStreams.get(pinnedClientId);
        if (remoteStream) {
          return { clientId: pinnedClientId, isLocal: false, stream: remoteStream };
        }
        
        // Check if it's in allVideos as fallback (shouldn't happen if remoteStreams is correct)
        const found = allVideos.find((v) => v.clientId === pinnedClientId && !v.isLocal);
        if (found) {
          console.warn('Pinned video found in allVideos but not in remoteStreams:', pinnedClientId);
          return found;
        }
        
        // If participant exists but no stream yet, create object with null stream
        if (participants.has(pinnedClientId)) {
          return { clientId: pinnedClientId, isLocal: false, stream: null };
        }
        
        return null;
      })()
    : null;
  
  // Debug logging
  useEffect(() => {
    if (pinnedClientId) {
      console.log('VideoGrid: pinnedClientId:', pinnedClientId, 'pinnedVideo found:', !!pinnedVideo, 'pinnedVideo stream:', !!pinnedVideo?.stream, 'allVideos:', allVideos.map(v => v.clientId), 'remoteStreams:', Array.from(remoteStreams.keys()), 'participants:', Array.from(participants.keys()));
    }
  }, [pinnedClientId, pinnedVideo, allVideos, participants, remoteStreams]);
  
  // Update pinned video stream when it arrives or changes
  useEffect(() => {
    if (pinnedVideo && !pinnedVideo.isLocal && pinnedVideo.stream && pinnedClientId) {
      // Use a small delay to ensure the video element is rendered
      const timer = setTimeout(() => {
        const videoRef = remoteVideoRefs.current.get(pinnedClientId);
        if (videoRef) {
          // Only update if it's the correct stream for this clientId
          const expectedStream = remoteStreams.get(pinnedClientId);
          if (expectedStream && videoRef.srcObject !== expectedStream) {
            console.log('Updating pinned video stream for:', pinnedClientId, 'stream id:', expectedStream.id);
            videoRef.srcObject = expectedStream;
          } else if (!expectedStream) {
            console.warn('Pinned video stream not found in remoteStreams for:', pinnedClientId);
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pinnedVideo, pinnedClientId, remoteStreams]);
  
  const unpinnedVideos = pinnedVideo 
    ? allVideos.filter((v) => v.clientId !== pinnedClientId)
    : allVideos;

  // If someone is pinned, show them large on top, others in grid below
  if (pinnedVideo && pinnedClientId) {
    const participant = getParticipantInfo(pinnedVideo.clientId);
    const displayName = participant?.displayName || (pinnedVideo.isLocal ? 'You' : pinnedVideo.clientId.substring(0, 8));

    return (
      <div className="h-full w-full flex flex-col gap-2">
        {/* Pinned Video - Large */}
        <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden min-h-0">
          {pinnedVideo.isLocal ? (
            <video
              key={`pinned-local-${localStream?.id || 'no-stream'}`}
              ref={(el) => {
                if (el) {
                  localVideoRef.current = el;
                  localVideoRefs.current.add(el);
                  // Set stream immediately
                  if (localStream && el.srcObject !== localStream) {
                    el.srcObject = localStream;
                  }
                } else {
                  // Element unmounted - clear main ref if it was this element
                  if (localVideoRef.current === el) {
                    localVideoRef.current = null;
                  }
                }
              }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : pinnedVideo.stream ? (
            <video
              key={`pinned-${pinnedVideo.clientId}-${pinnedVideo.stream.id}`}
              ref={(el) => {
                if (el) {
                  // Only set ref and stream if this is the correct clientId
                  if (pinnedClientId === pinnedVideo.clientId) {
                    remoteVideoRefs.current.set(pinnedVideo.clientId, el);
                    // Always set stream to ensure it's updated - use stream from remoteStreams to ensure correctness
                    const correctStream = remoteStreams.get(pinnedVideo.clientId);
                    if (correctStream) {
                      console.log('Setting stream for pinned video element:', pinnedVideo.clientId, 'stream id:', correctStream.id);
                      el.srcObject = correctStream;
                    } else if (pinnedVideo.stream) {
                      // Fallback to pinnedVideo.stream if not in remoteStreams yet
                      console.log('Using fallback stream for pinned video:', pinnedVideo.clientId);
                      el.srcObject = pinnedVideo.stream;
                    }
                  } else {
                    console.warn('Pinned video clientId mismatch:', pinnedClientId, 'vs', pinnedVideo.clientId);
                  }
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Waiting for video...</p>
              </div>
            </div>
          )}
          
          {/* Pin button - top right */}
          <button
            onClick={() => onPin(null)}
            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors z-10"
            title="Unpin"
          >
            <Pin className="w-5 h-5 text-primary-400 fill-primary-400" />
          </button>

          {/* Participant info - bottom left */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <span className="text-sm font-medium text-white">
              {displayName}
            </span>
            {pinnedVideo.isLocal ? (
              <>
                {localStream?.getAudioTracks()[0]?.enabled ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
                {participant.screenSharing ? (
                  <div title="Sharing screen">
                    <Monitor className="w-4 h-4 text-primary-400" />
                  </div>
                ) : localStream?.getVideoTracks()[0]?.enabled ? (
                  <Video className="w-4 h-4 text-green-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-red-400" />
                )}
              </>
            ) : (
              <>
                {participant.audioEnabled !== false ? (
                  <Mic className="w-4 h-4 text-green-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-red-400" />
                )}
                {participant.screenSharing ? (
                  <div title="Sharing screen">
                    <Monitor className="w-4 h-4 text-primary-400" />
                  </div>
                ) : participant.videoEnabled !== false ? (
                  <Video className="w-4 h-4 text-green-400" />
                ) : (
                  <VideoOff className="w-4 h-4 text-red-400" />
                )}
              </>
            )}
          </div>
        </div>

        {/* Unpinned Videos - Grid below */}
        {unpinnedVideos.length > 0 && (
          <div className={`h-32 video-grid video-grid-${Math.min(unpinnedVideos.length, 5)}`}>
            {unpinnedVideos.map((video) => {
              const participant = getParticipantInfo(video.clientId);
              const displayName = participant?.displayName || (video.isLocal ? 'You' : video.clientId.substring(0, 8));

              return (
                <div
                  key={`${video.clientId}-${displayName}`}
                  className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center"
                >
                  {video.isLocal ? (
                    <video
                      key={`unpinned-local-${localStream?.id || 'no-stream'}`}
                      ref={(el) => {
                        if (el) {
                          localVideoRefs.current.add(el);
                          // Set stream immediately
                          if (localStream && el.srcObject !== localStream) {
                            el.srcObject = localStream;
                          }
                        }
                        // Note: We don't delete from Set on unmount as el is null
                        // The Set will be cleared when component unmounts
                      }}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      key={`unpinned-${video.clientId}-${video.stream?.id || 'no-stream'}`}
                      ref={(el) => {
                        if (el) {
                          remoteVideoRefs.current.set(video.clientId, el);
                          // Set stream immediately when element is created
                          if (video.stream && el.srcObject !== video.stream) {
                            console.log('Setting stream for unpinned video:', video.clientId);
                            el.srcObject = video.stream;
                          }
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Pin button */}
                  <button
                    onClick={() => onPin(video.clientId)}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded transition-colors z-10 opacity-0 group-hover:opacity-100"
                    title="Pin"
                  >
                    <PinOff className="w-4 h-4 text-white" />
                  </button>

                  {/* Participant info */}
                  <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs">
                    <span className="text-xs font-medium text-white truncate max-w-[80px]">
                      {displayName}
                    </span>
                    {video.isLocal ? (
                      <>
                        {localStream?.getAudioTracks()[0]?.enabled ? (
                          <Mic className="w-3 h-3 text-green-400" />
                        ) : (
                          <MicOff className="w-3 h-3 text-red-400" />
                        )}
                        {participant.screenSharing ? (
                          <Monitor className="w-3 h-3 text-primary-400" />
                        ) : localStream?.getVideoTracks()[0]?.enabled ? (
                          <Video className="w-3 h-3 text-green-400" />
                        ) : (
                          <VideoOff className="w-3 h-3 text-red-400" />
                        )}
                      </>
                    ) : (
                      <>
                        {participant.audioEnabled !== false ? (
                          <Mic className="w-3 h-3 text-green-400" />
                        ) : (
                          <MicOff className="w-3 h-3 text-red-400" />
                        )}
                        {participant.screenSharing ? (
                          <Monitor className="w-3 h-3 text-primary-400" />
                        ) : participant.videoEnabled !== false ? (
                          <Video className="w-3 h-3 text-green-400" />
                        ) : (
                          <VideoOff className="w-3 h-3 text-red-400" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // No one is pinned - show normal grid
  const totalParticipants = 1 + remoteStreams.size;
  const gridClass = `video-grid video-grid-${Math.min(totalParticipants, 10)}`;

  return (
    <div className={`${gridClass} h-full w-full`}>
      {/* Local Video */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center">
        <video
          key={`normal-local-${localStream?.id || 'no-stream'}`}
          ref={(el) => {
            if (el) {
              localVideoRef.current = el;
              localVideoRefs.current.add(el);
              // Set stream immediately
              if (localStream && el.srcObject !== localStream) {
                el.srcObject = localStream;
              }
            } else {
              // Element unmounted - clear main ref if it was this element
              if (localVideoRef.current === el) {
                localVideoRef.current = null;
              }
            }
          }}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Pin button */}
        <button
          onClick={() => onPin(pinnedClientId === localClientId ? null : localClientId)}
          className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors z-10 opacity-0 group-hover:opacity-100"
          title={pinnedClientId === localClientId ? 'Unpin' : 'Pin'}
        >
          {pinnedClientId === localClientId ? (
            <Pin className="w-5 h-5 text-primary-400 fill-primary-400" />
          ) : (
            <PinOff className="w-5 h-5 text-white" />
          )}
        </button>

        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <span className="text-sm font-medium text-white">
            {getParticipantInfo(localClientId).displayName || 'You'}
          </span>
          {localStream?.getAudioTracks()[0]?.enabled ? (
            <Mic className="w-4 h-4 text-green-400" />
          ) : (
            <MicOff className="w-4 h-4 text-red-400" />
          )}
          {getParticipantInfo(localClientId).screenSharing ? (
            <div title="Sharing screen">
              <Monitor className="w-4 h-4 text-primary-400" />
            </div>
          ) : localStream?.getVideoTracks()[0]?.enabled ? (
            <Video className="w-4 h-4 text-green-400" />
          ) : (
            <VideoOff className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {/* Remote Videos */}
      {Array.from(remoteStreams.entries()).map(([clientId, stream]) => {
        const participant = getParticipantInfo(clientId);
        const displayName = participant?.displayName || clientId.substring(0, 8);
        const isPinned = pinnedClientId === clientId;

        return (
          <div key={`${clientId}-${displayName}`} className="relative bg-gray-900 rounded-lg overflow-hidden group min-h-0 flex items-center justify-center">
            <video
              key={`normal-${clientId}-${stream.id}`}
              ref={(el) => {
                if (el) {
                  remoteVideoRefs.current.set(clientId, el);
                  // Set stream immediately when element is created
                  if (stream && el.srcObject !== stream) {
                    console.log('Setting stream for normal grid video:', clientId);
                    el.srcObject = stream;
                  }
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Pin button */}
            <button
              onClick={() => onPin(isPinned ? null : clientId)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors z-10 opacity-0 group-hover:opacity-100"
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? (
                <Pin className="w-5 h-5 text-primary-400 fill-primary-400" />
              ) : (
                <PinOff className="w-5 h-5 text-white" />
              )}
            </button>

            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="text-sm font-medium text-white">
                {displayName}
              </span>
              {participant.audioEnabled !== false ? (
                <Mic className="w-4 h-4 text-green-400" />
              ) : (
                <MicOff className="w-4 h-4 text-red-400" />
              )}
              {participant.screenSharing ? (
                <div title="Sharing screen">
                  <Monitor className="w-4 h-4 text-primary-400" />
                </div>
              ) : participant.videoEnabled !== false ? (
                <Video className="w-4 h-4 text-green-400" />
              ) : (
                <VideoOff className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


