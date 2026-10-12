import { useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { createSignedFileUrl } from '../lib/coachingService';

/** Nút mở file private qua signed URL (URL có thời hạn, không lưu vào DB). */
export function AttachmentLink({
  path,
  label = 'Mở tệp đính kèm',
}: {
  path: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const open = async () => {
    setLoading(true);
    setErr('');
    try {
      const url = await createSignedFileUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không mở được tệp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => void open()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emblue hover:underline disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        {label}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </span>
  );
}
