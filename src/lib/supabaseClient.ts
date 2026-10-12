import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Hỗ trợ cả tên biến mới (PUBLISHABLE_KEY) lẫn tên cũ (ANON_KEY) — giống app thi thử.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Không throw để app vẫn render được màn hình báo cấu hình thiếu.
  console.error(
    '[supabase] Thiếu cấu hình. Hãy tạo .env từ .env.example với VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY (hoặc VITE_SUPABASE_ANON_KEY).'
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Khi thiếu env, dùng placeholder hợp lệ để createClient không throw lúc khởi động.
// Mọi request thật sẽ thất bại cho tới khi .env được cấu hình; UI hiển thị cảnh báo.
const clientUrl = supabaseUrl || 'https://placeholder.supabase.co';
const clientKey = supabaseAnonKey || 'placeholder-anon-key';

// Client dùng CHUNG project production với test.e-master.vn.
// Chỉ dùng public key — tuyệt đối không đặt service-role key ở browser.
export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
