import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { roleHome } from '../components/RequireRole';

export function LoginPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Đã đăng nhập với vai trò hợp lệ → về đúng trang chủ.
  if (!loading && session && role && role !== 'guest') {
    return <Navigate to={roleHome(role)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      // AuthProvider sẽ nạp profile; "/" tự điều hướng theo vai trò.
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-master text-lg font-bold text-white">
            EM
          </span>
          <h1 className="mt-4 text-2xl font-bold text-master">
            E-<span className="text-emblue">Master</span> Personal Coaching
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Đăng nhập để tiếp tục hành trình học có huấn luyện viên đồng hành.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          {!isSupabaseConfigured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Chưa cấu hình Supabase. Hãy tạo file <code>.env</code> từ{' '}
              <code>.env.example</code> với <code>VITE_SUPABASE_URL</code> và{' '}
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (hoặc{' '}
              <code>VITE_SUPABASE_ANON_KEY</code>), rồi khởi động lại dev server.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emblue focus:ring-2 focus:ring-emblue/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emblue focus:ring-2 focus:ring-emblue/20"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-master py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Đăng nhập
              </button>

              <p className="text-center text-xs text-slate-400">
                Coaching chỉ dành cho tài khoản đã được cấp. Liên hệ quản trị viên E-Master nếu
                bạn chưa có tài khoản.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
