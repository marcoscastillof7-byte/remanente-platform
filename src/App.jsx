import { Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/shared/Toast';
import { ProtectedRoute, AdminRoute } from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BookPage from './pages/BookPage';
import ChapterPage from './pages/ChapterPage';
import QuizPage from './pages/QuizPage';
import FlashcardsPage from './pages/FlashcardsPage';
import CustomQuizPage from './pages/CustomQuizPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserPerformance from './pages/admin/UserPerformance';
import QuestionManager from './pages/admin/QuestionManager';
import AdminReports from './pages/admin/AdminReports';

const Layout = ({ children }) => (
  <div className="flex flex-col min-h-screen bg-[var(--color-parchment)]">
    <Navbar />
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  </div>
);

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout><DashboardPage /></Layout>} />
            <Route path="/books/:bookId" element={<Layout><BookPage /></Layout>} />
            <Route path="/chapters/:chapterId" element={<Layout><ChapterPage /></Layout>} />
            <Route path="/quiz/:chapterId" element={<Layout><QuizPage /></Layout>} />
            <Route path="/flashcards/:chapterId" element={<Layout><FlashcardsPage /></Layout>} />
            <Route path="/custom-quiz" element={<Layout><CustomQuizPage /></Layout>} />
            <Route path="/leaderboard" element={<Layout><LeaderboardPage /></Layout>} />
            <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
            <Route path="/admin/users/:userId" element={<Layout><UserPerformance /></Layout>} />
            <Route path="/admin/questions/:chapterId" element={<Layout><QuestionManager /></Layout>} />
            <Route path="/admin/reports" element={<Layout><AdminReports /></Layout>} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
