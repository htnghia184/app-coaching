import { useEffect, useState, type FormEvent } from 'react';
import type { Submission, SubmissionRevision } from '../lib/types';
import { RevisionHistory } from '../components/RevisionHistory';
import { SavedRecording } from './AudioPrompt';
import {
  getAttemptForSubmission, listModuleRecordings, reviewModuleSubmission,
  type ModuleAttempt, type ModuleRecording,
} from './moduleService';
import { reeManifest } from './ree';
import { meetsReeMastery, reviewRecording } from './reviewEvidence';

export function CoachModuleReview({ submission, revisions, onChanged }: {
  submission: Submission;
  revisions: SubmissionRevision[];
  onChanged: () => Promise<void>;
}) {
  const [attempt, setAttempt] = useState<ModuleAttempt | null>(null);
  const [recordings, setRecordings] = useState<ModuleRecording[]>([]);
  const [inheritedRecordings, setInheritedRecordings] = useState<ModuleRecording[]>([]);
  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [feedback, setFeedback] = useState('');
  const [requestRevision, setRequestRevision] = useState(false);
  const [durationConfirmed, setDurationConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAttemptForSubmission(submission.id)
      .then(async (found) => {
        if (!active) return;
        setAttempt(found);
        const [current, inherited] = await Promise.all([
          found ? listModuleRecordings(found.id) : Promise.resolve([]),
          found?.inherited_evidence_attempt_id
            ? listModuleRecordings(found.inherited_evidence_attempt_id) : Promise.resolve([]),
        ]);
        if (!active) return;
        setRecordings(current);
        setInheritedRecordings(inherited.filter((item) => item.prompt_id !== 'verify'));
        const previous = submission.feedback_data?.criteria;
        if (previous && typeof previous === 'object') {
          setScores(previous as Record<string, number>);
        }
        setFeedback(submission.feedback_text ?? '');
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được bằng chứng module.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [submission]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!feedback.trim() || !durationConfirmed || reeManifest.rubric.some((item) => scores[item.id] === undefined)) {
      setError('Nhập phản hồi, điểm 0–2 và xác nhận đã kiểm tra thời lượng audio.'); return;
    }
    setSaving(true); setError('');
    try {
      await reviewModuleSubmission({
        submissionId: submission.id,
        feedbackText: feedback.trim(),
        scores: scores as Record<string, number>,
        requestRevision,
        durationConfirmed,
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được đánh giá.');
    } finally { setSaving(false); }
  };

  if (loading) return <p className="mt-3 text-sm text-slate-500">Đang tải bằng chứng module...</p>;
  if (error && !attempt) return <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>;
  const total = Object.values(scores).reduce<number>((sum, score) => sum + (score ?? 0), 0);
  const verify = attempt ? reviewRecording(attempt.id, attempt.inherited_evidence_attempt_id,
    recordings, inheritedRecordings, 'verify')?.recording : undefined;
  return <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
    <p className="text-sm font-semibold text-master">Verify · {reeManifest.title} · phiên bản {reeManifest.version}</p>
    {attempt ? <p className="text-xs text-slate-600">Lượt học {attempt.attempt_number} · {attempt.status === 'mastered' ? 'Mastered' : attempt.status === 'revision_required' ? 'Cần sửa' : 'Chờ chấm'}</p> :
      <p className="text-sm text-amber-800">Chưa tìm thấy lượt học liên kết với bài nộp này.</p>}
    {(['discover','apply-1','apply-2','apply-3','verify'] as const).map((id) => {
      const evidence = attempt ? reviewRecording(attempt.id, attempt.inherited_evidence_attempt_id,
        recordings, inheritedRecordings, id) : null;
      if (!evidence) return null;
      const item = evidence.recording;
      const prompt = id === 'discover' || id === 'verify'
        ? reeManifest.discoverPrompt : reeManifest.apply.prompts.find((p) => p.id === id)?.text;
      return <div key={id}>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">{id} · {prompt} · {evidence.inherited ? 'bằng chứng giữ từ lượt trước' : `lượt đang chấm #${attempt?.attempt_number}`}</p>
        <SavedRecording recording={item} />
      </div>;
    })}
    {submission.feedback_text && <div className="rounded-lg bg-emerald-50 p-3 text-sm">
      <p className="font-semibold">Phản hồi đã lưu</p>
      <p className="mt-1 whitespace-pre-wrap">{submission.feedback_text}</p>
      <p className="mt-1">Điểm: {submission.feedback_score ?? '—'}/8</p>
    </div>}
    {revisions.length > 0 && <RevisionHistory revisions={revisions} embedded title="Lịch sử Verify" />}
    {attempt?.status === 'awaiting_review' && submission.status === 'submitted' && !verify &&
      <p role="alert" className="text-sm text-red-700">Không tìm thấy Verify của lượt đang chấm; chưa thể đánh giá.</p>}
    {attempt?.status === 'awaiting_review' && submission.status === 'submitted' && verify && <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm font-semibold text-master">Rubric nguyên bản · 0–2 điểm mỗi tiêu chí</p>
      {reeManifest.rubric.map((criterion) => <fieldset key={criterion.id} className="rounded-lg border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-semibold">{criterion.title}</legend>
        <div className="space-y-1">{criterion.anchors.map((anchor, score) =>
          <label key={anchor} className="flex gap-2 text-sm">
            <input type="radio" name={criterion.id} checked={scores[criterion.id] === score}
              onChange={() => setScores((old) => ({ ...old, [criterion.id]: score }))} />
            <span>{score}: {anchor}</span>
          </label>)}</div>
      </fieldset>)}
      <p className="text-sm font-semibold text-master">Tổng: {total}/8</p>
      <p className="text-xs text-slate-600">Mastery: ≥6/8, không tiêu chí nào 0, Verify 20–30 giây; coach quyết định cuối.</p>
      {verify && <p className="text-xs text-slate-600">Theo điểm và thời lượng đã lưu: {meetsReeMastery(scores, verify.duration_seconds, requestRevision) ? 'đủ ngưỡng Mastery' : 'cần chỉnh sửa'}. Xác nhận bằng cách nghe file.</p>}
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={durationConfirmed} onChange={(event) => setDurationConfirmed(event.target.checked)} />
        Tôi đã nghe Verify của lượt đang chấm và đối chiếu thời lượng 20–30 giây.
      </label>
      <label className="block text-sm font-medium">Phản hồi cho học viên
        <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)}
          rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
      </label>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={requestRevision} onChange={(event) => setRequestRevision(event.target.checked)} />
        Yêu cầu sửa dù đủ ngưỡng
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-emblue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? 'Đang gửi...' : 'Gửi đánh giá'}
      </button>
    </form>}
  </div>;
}
