import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnlineStatus } from '../lib/useOnlineStatus';

/**
 * Các thông báo toàn cục ở đáy màn hình (xếp chồng, không che nội dung):
 * - Ngoại tuyến: nói rõ thao tác nào cần mạng.
 * - Có bản cập nhật: CHỈ cập nhật khi người dùng bấm, không tự reload
 *   (SW mới không skipWaiting) nên không ngắt bài đang làm dở.
 */
export function AppNotices() {
  const online = useOnlineStatus();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (online && !needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3">
      {!online ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex max-w-xl items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Bạn đang ngoại tuyến — chỉ xem được nội dung đã tải. Nộp bài và lưu nháp cần có mạng.
          </span>
        </div>
      ) : null}

      {needRefresh ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl bg-master px-4 py-2.5 text-sm text-white shadow-lg"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span className="flex-1">Đã có phiên bản mới của ứng dụng.</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-master transition hover:bg-white/90"
          >
            Cập nhật
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            title="Để sau"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
