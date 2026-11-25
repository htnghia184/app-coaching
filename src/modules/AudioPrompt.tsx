import { useEffect, useRef, useState } from 'react';
import { createSignedFileUrl, uploadCoachingFile } from '../lib/coachingService';
import { saveModuleRecording, type ModuleRecording } from './moduleService';

export function SavedRecording({ recording }: { recording: ModuleRecording }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    createSignedFileUrl(recording.storage_path, 3600)
      .then((signed) => { if (active) setUrl(signed); })
      .catch(() => { if (active) setError('Không mở được bản ghi âm.'); });
    return () => { active = false; };
  }, [recording.storage_path]);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs text-slate-500">Bản ghi {recording.duration_seconds} giây</p>
      {url ? <audio controls preload="none" src={url} className="w-full" /> : (
        <p className="text-sm text-slate-500">{error || 'Đang tải bản ghi...'}</p>
      )}
    </div>
  );
}

async function audioDuration(file: Blob): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = url;
    return await new Promise<number>((resolve, reject) => {
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(Math.ceil(audio.duration));
        else reject(new Error('Không đọc được thời lượng file.'));
      };
      audio.onerror = () => reject(new Error('Không đọc được file audio.'));
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AudioPrompt({
  attemptId, taskId, studentId, promptId, prompt, recordings, onSaved,
}: {
  attemptId: string;
  taskId: string;
  studentId: string;
  promptId: string;
  prompt: string;
  recordings: ModuleRecording[];
  onSaved: () => Promise<void>;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const [recording, setRecording] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = recordings.filter((item) => item.prompt_id === promptId);

  useEffect(() => () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const selectFile = (blob: Blob, name: string, seconds: number) => {
    setFile(blob);
    setFileName(name);
    setDuration(seconds);
    setPendingPath(null);
    setPreview(URL.createObjectURL(blob));
  };

  const start = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Trình duyệt chưa hỗ trợ ghi âm; hãy chọn file audio.');
      }
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type));
      const instance = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      recorder.current = instance;
      chunks.current = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      instance.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        const actualMime = instance.mimeType || mime || 'audio/webm';
        const ext = actualMime.includes('mp4') ? 'm4a' : actualMime.includes('ogg') ? 'ogg' : 'webm';
        selectFile(new Blob(chunks.current, { type: actualMime }), `${promptId}-${Date.now()}.${ext}`,
          Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
        setRecording(false);
      };
      startedAt.current = Date.now();
      instance.start();
      setRecording(true);
    } catch (cause) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(cause instanceof Error ? cause.message : 'Không truy cập được micro.');
    }
  };

  const choose = async (selected: File | undefined) => {
    if (!selected) return;
    setError('');
    try {
      if (!selected.type.startsWith('audio/')) throw new Error('Vui lòng chọn file audio.');
      selectFile(selected, selected.name, await audioDuration(selected));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đọc được file audio.');
    }
  };

  const save = async () => {
    if (!file || duration === null) return;
    setSaving(true);
    setError('');
    try {
      const path = pendingPath ?? await uploadCoachingFile(studentId, taskId, file, fileName);
      setPendingPath(path); // Retain path if metadata save fails; retry without uploading again.
      await saveModuleRecording(attemptId, promptId, path, duration);
      setFile(null);
      setPendingPath(null);
      setPreview('');
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lưu bản ghi âm thất bại. Thử lại khi có mạng.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-master">{prompt}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {recording ? (
          <button type="button" onClick={() => recorder.current?.stop()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">Dừng ghi âm</button>
        ) : (
          <button type="button" onClick={() => void start()} className="rounded-lg bg-master px-4 py-2 text-sm font-medium text-white">Ghi âm</button>
        )}
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">
          Chọn file audio
          <input type="file" accept="audio/*" className="sr-only" onChange={(event) => {
            void choose(event.target.files?.[0]); event.target.value = '';
          }} />
        </label>
      </div>
      {preview && <div className="mt-3">
        <p className="mb-1 text-xs text-slate-500">Nghe thử · {duration} giây</p>
        <audio controls src={preview} className="w-full" />
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-2 rounded-lg bg-emblue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Lưu bản ghi'}
        </button>
      </div>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {current.length > 0 && <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">Các lần đã lưu ({current.length})</p>
        {current.map((item) => <SavedRecording key={item.id} recording={item} />)}
      </div>}
    </section>
  );
}
