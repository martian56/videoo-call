import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { meetingsApi } from '../api/meetings';

export default function JoinMeeting() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState(searchParams.get('code') || '');
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (meetingCode) {
      verifyMeeting();
    }
  }, [meetingCode]);

  const verifyMeeting = async () => {
    if (meetingCode.length !== 10) return;
    
    try {
      // Normalize to lowercase for backend
      const normalizedCode = meetingCode.toLowerCase();
      await meetingsApi.getByCode(normalizedCode);
      setError('');
    } catch (err) {
      setError('Meeting not found. Please check the code.');
    }
  };

  const handleJoin = async () => {
    if (meetingCode.length !== 10) {
      setError('Please enter a valid 10-character meeting code');
      return;
    }

    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      // Normalize to lowercase for backend
      const normalizedCode = meetingCode.toLowerCase();
      await meetingsApi.getByCode(normalizedCode);
      navigate(`/meeting/${normalizedCode}?name=${encodeURIComponent(displayName)}`);
    } catch (err) {
      setError('Failed to join meeting. Please check the code and try again.');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
          <h1 className="text-3xl font-bold mb-2">Join Meeting</h1>
          <p className="text-gray-400 mb-6">Enter the meeting code and your name</p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Meeting Code
              </label>
              <input
                type="text"
                value={meetingCode}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                  setMeetingCode(value);
                }}
                placeholder="abc123xyz0"
                maxLength={10}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-center text-lg tracking-wider"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={isJoining || meetingCode.length !== 10 || !displayName.trim()}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Join Meeting
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


