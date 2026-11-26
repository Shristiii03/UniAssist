import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { StudentDashboard } from './pages/StudentDashboard.tsx';
import { ChatbotPage } from './pages/ChatbotPage.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { NoticesAndFaqsPage } from './pages/NoticesAndFaqsPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/signup" element={<AuthPage initialMode="register" />} />
            <Route path="/notices" element={<NoticesAndFaqsPage />} />
            <Route path="/about" element={<AboutPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/chat" element={<ChatbotPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdminRole>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
