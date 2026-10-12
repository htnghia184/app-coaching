import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AppNotices } from './components/AppNotices';
import { LoginPage } from './components/LoginPage';
import { RequireRole, RootRedirect } from './components/RequireRole';
import { AdminEnrollment } from './pages/AdminEnrollment';
import { CoachDashboard } from './pages/CoachDashboard';
import { CoachWorkspace } from './pages/CoachWorkspace';
import { StudentDashboard } from './pages/StudentDashboard';
import { StudentTaskDetail } from './pages/StudentTaskDetail';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Khu vực đã đăng nhập */}
        <Route element={<RequireRole role="student"><AppLayout /></RequireRole>}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/tasks/:taskId" element={<StudentTaskDetail />} />
        </Route>

        <Route element={<RequireRole role="teacher"><AppLayout /></RequireRole>}>
          <Route path="/coach" element={<CoachDashboard />} />
          <Route path="/coach/workspace/:enrollmentId" element={<CoachWorkspace />} />
        </Route>

        <Route element={<RequireRole role="admin"><AppLayout /></RequireRole>}>
          <Route path="/admin" element={<AdminEnrollment />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AppNotices />
    </>
  );
}
