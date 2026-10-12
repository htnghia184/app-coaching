import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  RotateCcw,
  Save,
  Square,
  Upload,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  createSubmission,
  getSubmission,
  getTask,
  listSubmissionRevisions,
  updateOwnSubmission,
  uploadCoachingFile,
} from '../lib/coachingService';
import { formatDate, formatDateTime } from '../lib/format';
import type { CoachingTask, Submission, SubmissionRevision } from '../lib/types';
import { SubmissionBadge } from '../components/StatusBadge';
import { AttachmentLink } from '../components/AttachmentLink';
import { RevisionHistory } from '../components/RevisionHistory';
import { Spinner } from '../components/Spinner';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emblue focus:ring-2 focus:ring-emblue/20';

const TASK_TYPE_LABEL: Record<string, string> = {
  text: 'Text response',
  audio: 'Audio recording',
  file: 'File upload',
  checkoff: 'Check-off',
};

export function StudentTaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { profile } = useAuth();

  const [task, setTask] = useState<CoachingTask | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [revisions, setRevisions] = useState<SubmissionRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [textResponse, setTextResponse] = useState('');
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  const [newFile, setNewFile] = useState<Blob | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [pendingDuration, setPendingDuration] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  // Audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  const load = useCallback(async () => {
    if (!taskId || !profile) return;
    setLoading(true);
    setError('');
    try {
      const t = await getTask(taskId);
      setTask(t);
      if (!t) {
        setError('Không tìm thấy nhiệm vụ hoặc bạn không có quyền truy cập.');
        return;
      }
      const s = await getSubmission(t.id, profile.id);
      setSubmission(s);
      setTextResponse(s?.text_response ?? '');
      setAttachmentPath(s?.storage_path ?? null);
      setDurationSeconds(s?.duration_seconds ?? null);
      setRevisions(s ? await listSubmissionRevisions([s.id]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được nhiệm vụ');
    } finally {
      setLoading(false);
    }
  }, [taskId, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Dọn dẹp khi rời trang
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const replacePreview = (next: string | null) => {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return next;
    });
  };

  const startRecording = async () => {
    setSaveErr('');
    setSaveMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const seconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setNewFile(blob);
        setNewFileName(`recording-${Date.now()}.webm`);
        setPendingDuration(seconds);
        replacePreview(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);
      };
      mediaRecorderRef.current = rec;
      startTimeRef.current = Date.now();
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setSaveErr('Không truy cập được micro. Vui lòng kiểm tra quyền trình duyệt.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNewFile(f);
    setNewFileName(f.name);
    setPendingDuration(null);
    replacePreview(URL.createObjectURL(f));
    e.target.value = '';
  };

  const persist = async (submit: boolean) => {
    if (!task || !profile) return;
    setSaveErr('');
    setSaveMsg('');

    if (submit) {
      if (task.task_type === 'text' && !textResponse.trim()) {
        setSaveErr('Vui lòng nhập nội dung trả lời trước khi nộp.');
        return;
      }
      if (task.task_type === 'audio' && !attachmentPath && !newFile) {
        setSaveErr('Vui lòng ghi âm hoặc tải lên file audio trước khi nộp.');
        return;
      }
      if (task.task_type === 'file' && !attachmentPath && !newFile) {
        setSaveErr('Vui lòng tải lên tệp trước khi nộp.');
        return;
      }
    }

    setSaving(true);
    try {
      let path = attachmentPath;
      let dur = durationSeconds;
      if (newFile) {
        path = await uploadCoachingFile(profile.id, task.id, newFile, newFileName || 'upload');
        if (pendingDuration !== null) dur = pendingDuration;
      }

      const payload = {
        text_response: textResponse.trim() ? textResponse : null,
        storage_path: path,
        duration_seconds: dur,
        submit,
      };

      if (submission) {
        await updateOwnSubmission({ submission_id: submission.id, ...payload });
      } else {
        await createSubmission({
          task_id: task.id,
          student_id: profile.id,
          ...payload,
        });
      }

      const fresh = await getSubmission(task.id, profile.id);
      setSubmission(fresh);
      setTextResponse(fresh?.text_response ?? '');
      setAttachmentPath(fresh?.storage_path ?? null);
      setDurationSeconds(fresh?.duration_seconds ?? null);
      setRevisions(fresh ? await listSubmissionRevisions([fresh.id]) : []);
      setNewFile(null);
      setNewFileName('');
      setPendingDuration(null);
      replacePreview(null);
      setSaveMsg(submit ? 'Đã nộp bài thành công.' : 'Đã lưu nháp.');
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Lưu bài thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Đang tải nhiệm vụ..." />;

  if (error || !task) {
    return (
      <div className="page-container">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'Không tìm thấy nhiệm vụ.'}
        </div>
        <Link
          to="/student"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emblue"
        >
          <ArrowLeft className="h-4 w-4" /> Về trang chủ
        </Link>
      </div>
    );
  }

  const locked = submission?.status === 'reviewed';
  const isAudio = task.task_type === 'audio';
  const isFile = task.task_type === 'file';
  const isText = task.task_type === 'text';

  return (
    <div className="page-container space-y-5">
      <Link
        to="/student"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emblue"
      >
        <ArrowLeft className="h-4 w-4" /> Về trang chủ
      </Link>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
              {task.due_at ? ` • hạn ${formatDate(task.due_at)}` : ''}
              {task.is_required ? ' • bắt buộc' : ''}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-master">{task.title}</h1>
          </div>
          {submission ? <SubmissionBadge status={submission.status} /> : null}
        </div>

        {task.instructions ? (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {task.instructions}
          </p>
        ) : null}
      </section>

      {/* Phản hồi của coach */}
      {submission &&
      (submission.feedback_text ||
        submission.feedback_score !== null ||
        submission.reviewed_at) ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Phản hồi từ coach
          </p>
          {submission.feedback_text ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">
              {submission.feedback_text}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-emerald-700">
            {submission.feedback_score !== null ? `Điểm: ${submission.feedback_score} • ` : ''}
            {submission.reviewed_at ? formatDateTime(submission.reviewed_at) : ''}
          </p>
        </section>
      ) : null}

      {submission?.status === 'revision_requested' ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          Coach yêu cầu bạn chỉnh sửa và nộp lại bài này.
        </div>
      ) : null}

      {locked ? (
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm text-slate-600">
          Bài đã được chấm. Nếu cần chỉnh sửa, vui lòng liên hệ coach để mở lại.
        </div>
      ) : null}

      {/* Khu vực làm bài */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        {isText ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Nội dung trả lời
            </span>
            <textarea
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              rows={8}
              disabled={locked}
              className={inputClass}
              placeholder="Nhập câu trả lời của bạn..."
            />
          </label>
        ) : null}

        {isAudio ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-700">Ghi âm</p>
            {!locked ? (
              <div className="flex flex-wrap items-center gap-3">
                {!recording ? (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark"
                  >
                    <Mic className="h-4 w-4" /> Bắt đầu ghi âm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    <Square className="h-4 w-4" /> Dừng ({recSeconds}s)
                  </button>
                )}

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
                  <Upload className="h-4 w-4" /> Tải file audio
                  <input type="file" accept="audio/*" onChange={onPickFile} className="hidden" />
                </label>
              </div>
            ) : null}

            {previewUrl ? (
              <audio controls src={previewUrl} className="w-full" />
            ) : null}

            {attachmentPath && !newFile ? (
              <div className="flex items-center gap-3">
                <AttachmentLink path={attachmentPath} label="Nghe bản đã nộp" />
                {durationSeconds !== null ? (
                  <span className="text-xs text-slate-400">{durationSeconds}s</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {isFile ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-700">Tệp đính kèm (PDF / ảnh)</p>
            {!locked ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
                <Upload className="h-4 w-4" /> Chọn tệp
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={onPickFile}
                  className="hidden"
                />
              </label>
            ) : null}

            {newFile ? (
              <p className="text-sm text-slate-500">
                Tệp mới: <span className="font-medium">{newFileName}</span> (sẽ tải lên khi lưu)
              </p>
            ) : attachmentPath ? (
              <AttachmentLink path={attachmentPath} label="Xem tệp đã nộp" />
            ) : (
              <p className="text-sm text-slate-400">Chưa có tệp nào.</p>
            )}
          </div>
        ) : null}

        {task.task_type === 'checkoff' ? (
          <p className="text-sm text-slate-600">
            Nhiệm vụ này chỉ cần bạn xác nhận đã hoàn thành.
          </p>
        ) : null}

        {/* Thông báo */}
        {saveErr ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {saveErr}
          </p>
        ) : null}
        {saveMsg ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {saveMsg}
          </p>
        ) : null}

        {/* Hành động */}
        {!locked ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void persist(true)}
              disabled={saving || recording}
              className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submission ? 'Nộp lại' : 'Nộp bài'}
            </button>
            <button
              type="button"
              onClick={() => void persist(false)}
              disabled={saving || recording}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Lưu nháp
            </button>
          </div>
        ) : (
          <div className="mt-5 inline-flex items-center gap-1.5 text-sm text-slate-400">
            <RotateCcw className="h-4 w-4" /> Đã khóa chỉnh sửa
          </div>
        )}
      </section>

      {/* Lịch sử các phiên bản bài nộp (Migration 020) */}
      <RevisionHistory revisions={revisions} />
    </div>
  );
}
