import { Link, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { roleHome } from './RequireRole';
import { initialOf, personLabel } from '../lib/format';
import type { UserRole } from '../lib/types';

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Học viên',
  teacher: 'Coach',
  admin: 'Quản trị',
  guest: 'Khách',
};

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-master text-sm font-bold text-white">
        EM
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-master">
          E-<span className="text-emblue">Master</span>
        </p>
        <p className="text-[11px] text-slate-400">Personal Coaching</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const home = roleHome(role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to={home} className="shrink-0">
            <Brand />
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-700">
                {personLabel(profile)}
              </p>
              <p className="text-[11px] text-slate-400">
                {role ? ROLE_LABEL[role] : ''}
              </p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emblue/10 text-sm font-semibold text-emblue sm:hidden">
              {initialOf(personLabel(profile))}
            </span>
            <button
              onClick={() => void signOut()}
              title="Đăng xuất"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
