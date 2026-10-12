import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { FullPageSpinner } from './Spinner';
import type { UserRole } from '../lib/types';

/** Điểm đến mặc định theo vai trò (student=learner, teacher=coach, admin). */
export function roleHome(role: UserRole | null): string {
  switch (role) {
    case 'student':
      return '/student';
    case 'teacher':
      return '/coach';
    case 'admin':
      return '/admin';
    default:
      return '/login';
  }
}

function UnauthorizedNotice() {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-semibold text-master">
          Tài khoản chưa được cấp quyền Coaching
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Tài khoản <span className="font-medium">{profile?.email ?? '—'}</span> chưa có vai trò
          hợp lệ (student / teacher / admin). Vui lòng liên hệ quản trị viên E-Master.
        </p>
        <button
          onClick={() => void signOut()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2 text-sm font-medium text-white hover:bg-master-dark"
        >
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </div>
    </div>
  );
}

/** Chuyển hướng theo vai trò — dùng cho route "/". */
export function RootRedirect() {
  const { loading, session, role } = useAuth();
  if (loading) return <FullPageSpinner label="Đang tải hồ sơ..." />;
  if (!session) return <Navigate to="/login" replace />;
  if (!role || role === 'guest') return <UnauthorizedNotice />;
  return <Navigate to={roleHome(role)} replace />;
}

interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

/** Bảo vệ route: bắt buộc đăng nhập + đúng vai trò; nếu sai thì đưa về trang chủ của vai trò. */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { loading, session, role: actualRole } = useAuth();

  if (loading) return <FullPageSpinner label="Đang kiểm tra quyền..." />;
  if (!session) return <Navigate to="/login" replace />;
  if (!actualRole || actualRole === 'guest') return <UnauthorizedNotice />;
  if (actualRole !== role) return <Navigate to={roleHome(actualRole)} replace />;

  return <>{children}</>;
}
