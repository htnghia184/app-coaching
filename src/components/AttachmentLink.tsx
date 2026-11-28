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

/** Private, on-demand playback. Never persist signed URLs or prefetch other learners' files. */
export function EvidenceAttachment({path, audio=false}:{path:string;audio?:boolean}) {
  return audio || /\.(webm|mp3|m4a|wav|ogg|aac|flac|mp4)$/i.test(path) ? <PrivateAudio key={path} path={path}/> : <AttachmentLink path={path}/>;
}
function PrivateAudio({path}:{path:string}) {
  const [url,setUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const load=async()=>{
    setBusy(true);setError('');setUrl('');
    try{setUrl(await createSignedFileUrl(path));}
    catch(e){setError(e instanceof Error?e.message:'Không tải được bản ghi âm');}
    finally{setBusy(false);}
  };
  return <div className="w-full space-y-2">
    <button type="button" disabled={busy} onClick={()=>void load()} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-master disabled:opacity-50">{busy?'Đang tải…':url?'Tải lại bản ghi âm':'Nghe bản ghi âm'}</button>
    {url&&<audio controls preload="metadata" className="w-full" src={url} onError={()=>setError('Không phát được audio. Hãy tải lại hoặc mở tệp.')}/>}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    <AttachmentLink path={path} label="Mở tệp riêng"/>
  </div>;
}
