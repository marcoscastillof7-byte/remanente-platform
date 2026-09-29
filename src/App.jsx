import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/shared/Toast';
import { ProtectedRoute, AdminRoute, SuperAdminRoute } from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoadingSpinner from './components/shared/LoadingSpinner';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BookPage = lazy(() => import('./pages/BookPage'));
const ChapterPage = lazy(() => import('./pages/ChapterPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage'));
const CustomQuizPage = lazy(() => import('./pages/CustomQuizPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserPerformance = lazy(() => import('./pages/admin/UserPerformance'));
const QuestionManager = lazy(() => import('./pages/admin/QuestionManager'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminSuggestions = lazy(() => import('./pages/admin/AdminSuggestions'));
const GlobalBulkImport = lazy(() => import('./pages/admin/GlobalBulkImport'));
const VideoManager = lazy(() => import('./pages/admin/VideoManager'));
const DuelsPage = lazy(() => import('./pages/DuelsPage'));
const SurvivalPage = lazy(() => import('./pages/SurvivalPage'));
const EssaysPage = lazy(() => import('./pages/EssaysPage'));
const AdminEssays = lazy(() => import('./pages/admin/AdminEssays'));
const SuperDashboard = lazy(() => import('./pages/superadmin/SuperDashboard'));

const Layout = ({ children }) => (
  <div className="flex flex-col min-h-screen bg-[var(--color-parchment)]">
    <Navbar />
    <div className="flex flex-1 overflow-hidden">
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><LoadingSpinner /></div>}>
          {children}
        </Suspense>
      </main>
    </div>
  </div>
);

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-[var(--color-parchment)]"><LoadingSpinner /></div>}>
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
              <Route path="/duels" element={<Layout><DuelsPage /></Layout>} />
              <Route path="/survival" element={<Layout><SurvivalPage /></Layout>} />
              <Route path="/essays" element={<Layout><EssaysPage /></Layout>} />

              <Route path="/admin" element={<Layout><AdminDashboard /></Layout>} />
              <Route path="/admin/users/:userId" element={<Layout><UserPerformance /></Layout>} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin/questions/:chapterId" element={<Layout><QuestionManager /></Layout>} />
              <Route path="/admin/reports" element={<Layout><AdminReports /></Layout>} />
              <Route path="/admin/suggestions" element={<Layout><AdminSuggestions /></Layout>} />
              <Route path="/admin/global-bulk" element={<Layout><GlobalBulkImport /></Layout>} />
              <Route path="/admin/videos" element={<Layout><VideoManager /></Layout>} />
              <Route path="/admin/essays" element={<Layout><AdminEssays /></Layout>} />
            </Route>
            
            <Route element={<SuperAdminRoute />}>
              <Route path="/superadmin" element={<Layout><SuperDashboard /></Layout>} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
