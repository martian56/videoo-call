import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, Plus, LogIn } from 'lucide-react';
import { meetingsApi } from '../api/meetings';

export default function Home() {
  const [isCreating, setIsCreating] = useState(false);
  const [meetingCode, setMeetingCode] = useState('');
  const navigate = useNavigate();

  const handleCreateMeeting = async () => {
    setIsCreating(true);
    try {
      const meeting = await meetingsApi.create({
        title: 'New Meeting',
        max_participants: 10,
      });
      navigate(`/meeting/${meeting.code}?name=${encodeURIComponent('Host')}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = () => {
    if (meetingCode.trim().length === 10) {
      const normalizedCode = meetingCode.toLowerCase();
      navigate(`/join?code=${normalizedCode}`);
    } else {
      alert('Please enter a valid 10-character meeting code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Video className="w-12 h-12 text-primary-500" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full border-2 border-gray-900"></div>
            </div>
            <h1 className="text-5xl font-bold gradient-text">
              LinkUp
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Connect instantly with your team. Modern video meetings for up to 10 people.
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Create Meeting Card */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-primary-500 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary-500/20 rounded-lg">
                <Plus className="w-6 h-6 text-primary-400" />
              </div>
              <h2 className="text-2xl font-semibold">New Meeting</h2>
            </div>
            <p className="text-gray-400 mb-6">
              Start an instant meeting and share the link with your team
            </p>
            <button
              onClick={handleCreateMeeting}
              disabled={isCreating}
              className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-500/50 hover:shadow-xl hover:shadow-primary-500/60 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create Meeting
                </>
              )}
            </button>
          </div>

          {/* Join Meeting Card */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 hover:border-primary-500 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <LogIn className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold">Join Meeting</h2>
            </div>
            <p className="text-gray-400 mb-6">
              Enter a meeting code to join an existing meeting
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value.toUpperCase())}
                placeholder="Enter meeting code"
                maxLength={10}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
              />
              <button
                onClick={handleJoinMeeting}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <Users className="w-6 h-6 text-primary-400 mb-2" />
            <h3 className="font-semibold mb-1">Up to 10 People</h3>
            <p className="text-sm text-gray-400">Connect with your team</p>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <Video className="w-6 h-6 text-primary-400 mb-2" />
            <h3 className="font-semibold mb-1">HD Video</h3>
            <p className="text-sm text-gray-400">Crystal clear quality</p>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <div className="w-6 h-6 text-primary-400 mb-2">💬</div>
            <h3 className="font-semibold mb-1">Live Chat</h3>
            <p className="text-sm text-gray-400">Chat during meetings</p>
          </div>
        </div>
      </div>
    </div>
  );
}


