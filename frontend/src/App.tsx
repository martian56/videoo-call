import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import JoinMeeting from './pages/JoinMeeting';
import MeetingRoom from './pages/MeetingRoom';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Home page */}
          <Route path="/" element={<Home />} />
          
          {/* Join meeting page */}
          <Route path="/join" element={<JoinMeeting />} />
          
          {/* Meeting room */}
          <Route path="/meeting/:meetingCode" element={<MeetingRoom />} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
