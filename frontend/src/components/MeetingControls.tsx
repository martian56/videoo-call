import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageSquare } from 'lucide-react';

interface MeetingControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onScreenShare?: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
  chatOpen: boolean;
  hasUnreadMessages?: boolean;
}

export default function MeetingControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onScreenShare,
  onLeave,
  onToggleChat,
  chatOpen,
  hasUnreadMessages = false,
}: MeetingControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
      {/* Audio Toggle */}
      <button
        onClick={onToggleAudio}
        className={`p-3 rounded-full transition-all ${
          audioEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700'
        }`}
        title={audioEnabled ? 'Mute' : 'Unmute'}
      >
        {audioEnabled ? (
          <Mic className="w-6 h-6 text-white" />
        ) : (
          <MicOff className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Video Toggle */}
      <button
        onClick={onToggleVideo}
        className={`p-3 rounded-full transition-all ${
          videoEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700'
        }`}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {videoEnabled ? (
          <Video className="w-6 h-6 text-white" />
        ) : (
          <VideoOff className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Screen Share */}
      {onScreenShare && (
        <button
          onClick={onScreenShare}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-all"
          title="Share screen"
        >
          <Monitor className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chat Toggle */}
      <button
        onClick={onToggleChat}
        className={`relative p-3 rounded-full transition-all ${
          chatOpen ? 'bg-primary-600 hover:bg-primary-700' : 'bg-gray-700 hover:bg-gray-600'
        }`}
        title="Toggle chat"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        {hasUnreadMessages && !chatOpen && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900"></span>
        )}
      </button>

      {/* Leave Meeting */}
      <button
        onClick={onLeave}
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-all"
        title="Leave meeting"
      >
        <PhoneOff className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}

