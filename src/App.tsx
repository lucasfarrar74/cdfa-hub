import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './components/auth/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { MeetingScheduler } from './pages/MeetingScheduler';
import { BudgetTracker } from './pages/BudgetTracker';
import { DataImport } from './pages/DataImport';
import { ActivityLinks } from './pages/ActivityLinks';
import { Backup } from './pages/Backup';
import { LiveSchedule } from './pages/LiveSchedule';
import './index.css';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isConfigured } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If Firebase not configured, allow access (dev mode)
  if (!isConfigured) {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated. Preserve the intended URL
  // (including the ?share=... query string on share links) via router
  // state so PublicRoute can send the user back to it after login.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Public route wrapper - redirects to dashboard if already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isConfigured } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If Firebase not configured, show the public page
  if (!isConfigured) {
    return <>{children}</>;
  }

  // Redirect back to the original destination if the user came here via
  // ProtectedRoute (which stashes `from` in router state) — this is what
  // preserves a `/meeting-scheduler?share=...` URL across the login
  // bounce. Falls back to the dashboard when there's no stashed location.
  if (user) {
    const from = (location.state as { from?: Location } | null)?.from;
    const destination = from ? `${from.pathname}${from.search}${from.hash}` : '/';
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected projector view — outside MainLayout so no app chrome shows */}
      <Route
        path="/meeting-scheduler/live"
        element={
          <ProtectedRoute>
            <LiveSchedule />
          </ProtectedRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects/*" element={<Projects />} />
        <Route path="meeting-scheduler" element={<MeetingScheduler />} />
        <Route path="budget-tracker" element={<BudgetTracker />} />
        <Route path="data-import" element={<DataImport />} />
        <Route path="activity-links" element={<ActivityLinks />} />
        <Route path="backup" element={<Backup />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
