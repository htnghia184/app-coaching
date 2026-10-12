import { useEffect, useState } from 'react';

/**
 * Theo dõi trạng thái mạng của trình duyệt (navigator.onLine + sự kiện online/offline).
 * Dùng để chặn/hiển thị đúng các thao tác bắt buộc có mạng (Supabase).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
