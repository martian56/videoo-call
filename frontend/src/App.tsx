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
          {/* Home page - Create or join meetings */}
          <Route path="/" element={<Home />} />
          
          {/* Join meeting page - Enter code and name */}
          <Route path="/join" element={<JoinMeeting />} />
          
          {/* Meeting room - Active video call */}
          <Route path="/meeting/:meetingCode" element={<MeetingRoom />} />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
