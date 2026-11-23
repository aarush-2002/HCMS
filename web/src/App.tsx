import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { HostelCanvas } from './components/background/HostelCanvas';

import StudentRoute from './components/guards/StudentRoute';
import WardenRoute from './components/guards/WardenRoute';
import AdminRoute from './components/guards/AdminRoute';
import PublicOnlyRoute from './components/guards/PublicOnlyRoute';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import StudentLoginPage from './pages/public/StudentLoginPage';
import WardenLoginPage from './pages/public/WardenLoginPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import NotFoundPage from './pages/public/NotFoundPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotificationsPage from './pages/NotificationsPage';

// Student Pages
import StudentDashboardPage from './pages/StudentDashboardPage';
import NewComplaintPage from './pages/NewComplaintPage';
import ComplaintDetailPage from './pages/ComplaintDetailPage';
import MyComplaintsPage from './pages/MyComplaintsPage';

// Warden Pages
import WardenDashboardPage from './pages/WardenDashboardPage';
import WardenComplaintDetailPage from './pages/WardenComplaintDetailPage';
import WardenOverduePage from './pages/WardenOverduePage';
import WardenPerformancePage from './pages/WardenPerformancePage';

// Admin Pages
import AdminDashboardPage from './pages/AdminDashboardPage';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            {/* Full-screen Three.js "night hostel" canvas */}
            <HostelCanvas />

            <div className="relative min-h-screen text-[#dfe7e0] font-sans">
              <Routes>
                {/* Public Landing & Recovery */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* Guest-only routes (redirect if logged in) */}
                <Route element={<PublicOnlyRoute />}>
                  <Route path="/student/login" element={<StudentLoginPage />} />
                  <Route path="/warden/login" element={<WardenLoginPage />} />
                </Route>

                {/* Universal Notifications Center */}
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* Student Protected Routes */}
                <Route element={<StudentRoute />}>
                  <Route path="/student" element={<StudentDashboardPage />} />
                  <Route path="/student/new" element={<NewComplaintPage />} />
                  <Route path="/student/complaints/:id" element={<ComplaintDetailPage />} />
                  <Route path="/student/my-complaints" element={<MyComplaintsPage />} />
                </Route>

                {/* Warden Protected Routes */}
                <Route element={<WardenRoute />}>
                  <Route path="/warden" element={<WardenDashboardPage />} />
                  <Route path="/warden/complaints/:id" element={<WardenComplaintDetailPage />} />
                  <Route path="/warden/overdue" element={<WardenOverduePage />} />
                  <Route path="/warden/performance" element={<WardenPerformancePage />} />
                </Route>

                {/* Admin Protected Routes */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                </Route>

                {/* Fallback & Error Routes */}
                <Route path="/forbidden" element={<ForbiddenPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
