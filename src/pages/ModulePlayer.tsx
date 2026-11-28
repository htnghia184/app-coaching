import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { createSubmission, getSubmission, getTask, listSubmissionRevisions, updateOwnSubmission } from '../lib/coachingService';
import type { CoachingTask, Submission, SubmissionRevision } from '../lib/types';
import { RevisionHistory } from '../components/RevisionHistory';
import { Spinner } from '../components/Spinner';
import { AudioPrompt, SavedRecording } from '../modules/AudioPrompt';
import { InteractionRegistry } from '../modules/InteractionRegistry';
import { validReeActivityResponse } from '../modules/activityValidation';
import { latestActivity, latestCurrentRecording, latestRecording } from '../modules/history';
import {
  listActivityAttempts, listModuleRecordings, saveModuleProgress, startModuleAttempt,
  submitActivity, submitModuleVerify,
  type ActivityAttempt, type ModuleAttempt, type ModuleRecording,
} from '../modules/moduleService';
import { reeManifest, REE_MODULE_ID, STAGES, type Stage } from '../modules/ree';

type McqResponse = Record<string, { choice: string; stage: string }>;
type MatchingResponse = Record<string, { explain: string; example: string }>;

const stageLabel: Record<Stage, string> = {
  Discover: 'Khám phá',
  Learn: 'Học',
  Practice: 'Luyện tập',
  Apply: 'Áp dụng',
  Reflect: 'Tự đánh giá',
  Verify: 'Coach xác nhận',
};

export function ModulePlayer() {
  const { taskId } = useParams<{ taskId: string }>();
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [task, setTask] = useState<CoachingTask | null>(null);
  const [attempt, setAttempt] = useState<ModuleAttempt | null>(null);
  const [activities, setActivities] = useState<ActivityAttempt[]>([]);
  const [recordings, setRecordings] = useState<ModuleRecording[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [revisions, setRevisions] = useState<SubmissionRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [viewStage, setViewStage] = useState<Stage>('Discover');
  const [mcq, setMcq] = useState<McqResponse>({});
  const [matching, setMatching] = useState<MatchingResponse>({});
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false, false]);
  const draftTimer = useRef<number | null>(null);
  const initialized = useRef(false);

  const refreshEvidence = useCallback(async (current: ModuleAttempt) => {
    const inheritedId = current.inherited_evidence_attempt_id;
    const [savedActivities, savedRecordings, inheritedActivities, inheritedRecordings] = await Promise.all([
      listActivityAttempts(current.id), listModuleRecordings(current.id),
      inheritedId ? listActivityAttempts(inheritedId) : Promise.resolve([]),
      inheritedId ? listModuleRecordings(inheritedId) : Promise.resolve([]),
    ]);
    setActivities([...inheritedActivities, ...savedActivities]);
    setRecordings([...inheritedRecordings.filter((item) => item.prompt_id !== 'verify'), ...savedRecordings]);
  }, []);

  useEffect(() => {
    if (!taskId || !profile) return;
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      const loadedTask = await getTask(taskId);
      if (!loadedTask || loadedTask.module_id !== REE_MODULE_ID) {
        throw new Error('Module chưa có nội dung tương ứng hoặc bạn không có quyền truy cập.');
      }
      const [loadedAttempt, loadedSubmission] = await Promise.all([
        startModuleAttempt(taskId), getSubmission(taskId, profile.id),
      ]);
      if (loadedAttempt.content_version !== reeManifest.version) {
        throw new Error('Phiên bản nội dung của lượt học chưa có trong ứng dụng này.');
      }
      const inheritedId = loadedAttempt.inherited_evidence_attempt_id;
      const [savedActivities, savedRecordings, inheritedActivities, inheritedRecordings, savedRevisions] = await Promise.all([
        listActivityAttempts(loadedAttempt.id),
        listModuleRecordings(loadedAttempt.id),
        inheritedId ? listActivityAttempts(inheritedId) : Promise.resolve([]),
        inheritedId ? listModuleRecordings(inheritedId) : Promise.resolve([]),
        loadedSubmission ? listSubmissionRevisions([loadedSubmission.id]) : Promise.resolve([]),
      ]);
      if (!active) return;
      setTask(loadedTask);
      setAttempt(loadedAttempt);
      setSubmission(loadedSubmission);
      setActivities([...inheritedActivities, ...savedActivities]);
      setRecordings([...inheritedRecordings.filter((item) => item.prompt_id !== 'verify'), ...savedRecordings]);
      setRevisions(savedRevisions);
      setViewStage(loadedAttempt.resume_stage);
      const practice = loadedAttempt.stage_data.Practice as
        { mcq?: McqResponse; matching?: MatchingResponse } | undefined;
      setMcq(practice?.mcq ?? {});
      setMatching(practice?.matching ?? {});
      const reflection = loadedAttempt.stage_data.Reflect as { checklist?: boolean[] } | undefined;
      if (Array.isArray(reflection?.checklist) && reflection.checklist.length === 5) {
        setChecklist(reflection.checklist);
      }
      initialized.current = true;
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Không tải được module.');
    }).finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      initialized.current = false;
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [taskId, profile, refreshEvidence]);

  // Keep unsubmitted selections durable. The server stores only learner responses here.
  useEffect(() => {
    if (!initialized.current || !attempt || attempt.status !== 'in_progress' ||
        viewStage !== 'Practice' || attempt.completed_stages.includes('Practice')) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      void saveModuleProgress(attempt.id, 'Practice', { mcq, matching }, false)
        .catch(() => setError('Chưa lưu được nháp Practice. Kiểm tra kết nối rồi thử lại.'));
    }, 600);
    return () => { if (draftTimer.current) window.clearTimeout(draftTimer.current); };
  }, [mcq, matching, attempt, viewStage]);

  const progress = async (stage: Stage, data: Record<string, unknown> = {}) => {
    if (!attempt) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await saveModuleProgress(attempt.id, stage, data, true);
      setAttempt(updated);
      setViewStage(updated.resume_stage);
      setMessage('Đã lưu tiến độ.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được tiến độ.');
    } finally { setBusy(false); }
  };

  const submitPractice = async (activityId: string, response: Record<string, unknown>) => {
    if (!attempt) return;
    if (!validReeActivityResponse(activityId, response)) {
      setError('Hoàn thành mọi câu bằng lựa chọn hợp lệ; Bài 2 cần ghép mỗi Explain và Example đúng một lần.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await submitActivity(attempt.id, activityId, response);
      setActivities((previous) => [...previous, saved]);
      setMessage('Đã nộp lượt làm. Đáp án và giải thích đã mở bên dưới.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không nộp được bài Practice.');
    } finally { setBusy(false); }
  };

  const submitVerify = async () => {
    if (!attempt || !task || !profile) return;
    const recording = latestCurrentRecording(recordings, 'verify', attempt.id);
    if (!recording) { setError('Vui lòng ghi âm và lưu câu trả lời Verify.'); return; }
    setBusy(true); setError('');
    try {
      let saved: Submission;
      if (submission?.status === 'submitted' && submission.storage_path === recording.storage_path) {
        saved = submission; // Safe retry after a partial network failure.
      } else if (submission) {
        saved = await updateOwnSubmission({
          submission_id: submission.id, text_response: null,
          storage_path: recording.storage_path,
          duration_seconds: recording.duration_seconds, submit: true,
        });
      } else {
        saved = await createSubmission({
          task_id: task.id, student_id: profile.id, text_response: null,
          storage_path: recording.storage_path,
          duration_seconds: recording.duration_seconds, submit: true,
        });
      }
      const updated = await submitModuleVerify(attempt.id, saved.id);
      setSubmission(saved);
      setAttempt(updated);
      setRevisions(await listSubmissionRevisions([saved.id]));
      setMessage('Đã nộp Verify. Coach sẽ xem và phản hồi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nộp Verify thất bại. Bạn có thể thử lại.');
    } finally { setBusy(false); }
  };

  const mcqAttempt = useMemo(() => latestActivity(activities, 'ree-mcq'), [activities]);
  const matchingAttempt = useMemo(() => latestActivity(activities, 'ree-matching'), [activities]);

  if (loading) return <Spinner label="Đang tải module..." />;
  if (error && !attempt) return (
    <div className="page-container space-y-4">
      <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{error}</p>
      <p className="text-sm text-slate-600">Module cần schema được duyệt, dữ liệu đáp án riêng và trạng thái publish trước khi học viên sử dụng.</p>
      <Link to="/student" className="text-emblue underline">Về trang học viên</Link>
    </div>
  );
  if (!attempt || !task || !profile) return null;
  const stageIndex = STAGES.indexOf(viewStage);
  const canEditStage = attempt.status === 'in_progress' && online &&
    viewStage === attempt.resume_stage && !attempt.completed_stages.includes(viewStage);
  const canVisit = (stage: Stage) =>
    STAGES.indexOf(stage) <= STAGES.indexOf(attempt.resume_stage) ||
    attempt.completed_stages.includes(stage);

  return (
    <div className="page-container pb-16">
      <Link to="/student" className="text-sm text-emblue">← Nhiệm vụ tuần</Link>
      <header className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-emblue">IELTS Speaking · B1 · khoảng 21 phút</p>
        <h1 className="mt-2 text-2xl font-bold text-master">{reeManifest.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{reeManifest.outcome}</p>
        <p className="mt-2 text-xs text-slate-500">Phiên bản nội dung {reeManifest.version} · Lượt học {attempt.attempt_number}</p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-master">
          {attempt.status === 'mastered' ? 'Đã đạt Mastered' :
            attempt.status === 'awaiting_review' ? 'Đã hoàn thành, đang chờ coach chấm' :
            attempt.status === 'revision_required' ? 'Coach yêu cầu chỉnh sửa' :
            attempt.completed_stages.length === 6 ? 'Đã hoàn thành các bước' : 'Đang học'}
        </p>
      </header>
      <nav aria-label="Tiến độ sáu bước" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAGES.map((stage, index) => (
          <button key={stage} type="button" disabled={!canVisit(stage)}
            aria-current={viewStage === stage ? 'step' : undefined}
            onClick={() => setViewStage(stage)}
            className={`min-h-20 rounded-xl border p-2 text-left text-xs disabled:opacity-40 ${viewStage === stage
              ? 'border-emblue bg-emblue/10 text-master' : 'border-slate-200 bg-white text-slate-600'}`}>
            <span className="block font-bold">{index + 1}. {stageLabel[stage]}</span>
            <span className="mt-1 block">{attempt.completed_stages.includes(stage) ? 'Đã xong' :
              viewStage === stage ? 'Đang học' : 'Chưa làm'}</span>
          </button>
        ))}
      </nav>
      <main className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-master">{stageIndex + 1}. {stageLabel[viewStage]}</h2>
          <span className="text-xs text-slate-500">~{reeManifest.stageMinutes[viewStage]} phút</span>
        </div>
        {!online && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Cần kết nối mạng để lưu tiến độ và ghi âm.</p>}
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        {viewStage === 'Discover' && <>
          <p className="mb-4 text-slate-700">Bạn ghi âm một câu trả lời trước khi học, để tự thấy mình hay dừng ở chỗ nào.</p>
          <p className="mb-4 text-sm text-slate-600">Bài làm: tạm dừng, ghi âm trả lời câu hỏi sau, rồi quay lại.</p>
          {canEditStage ? <AudioPrompt attemptId={attempt.id} taskId={task.id} studentId={profile.id}
            promptId="discover" prompt={reeManifest.discoverPrompt} recordings={recordings.filter((item) => item.attempt_id === attempt.id)}
            onSaved={() => refreshEvidence(attempt)} /> :
            latestRecording(recordings,'discover') && <SavedRecording recording={latestRecording(recordings,'discover')!} />}
          <p className="mt-4 text-sm text-slate-600">Nghe lại bản ghi âm và tự hỏi: mình đã đủ chi tiết chưa (có 1–2 ý mở rộng), hay trả lời xong rồi im? Giữ lại file ghi âm này, ở bước Verify bạn sẽ trả lời lại câu hỏi này để so sánh.</p>
          <p className="mt-3 text-sm text-slate-600">Vấn đề thường gặp: trả lời thẳng xong không biết nói gì thêm. Đây là chuyện rất thường gặp.</p>
          <p className="mt-2 text-sm text-slate-600">Điều cần nhớ: ở trường mình quen trả lời đúng câu hỏi, còn IELTS cần cho giám khảo thấy cách bạn nghĩ ra câu trả lời đó.</p>
          <p className="mt-2 text-sm text-slate-600">Module này dạy gì: Dùng phương pháp REE để mở rộng câu, kèm một số ngôn ngữ dùng được.</p>
          {canEditStage && <NextButton disabled={busy || !latestRecording(recordings, 'discover')} onClick={() => void progress('Discover')}>Tiếp tục đến Learn</NextButton>}
        </>}

        {viewStage === 'Learn' && <>
          {reeManifest.assets.filter((asset) => asset.stage === 'Learn' && asset.kind === 'video').map((asset) => (
            <div key={asset.id} className="mb-5 rounded-xl border border-emblue/20 bg-emblue/5 p-4">
              <p className="font-semibold text-master">Video bài học: {asset.id}</p>
              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-emblue underline">Mở video Learn trên SharePoint</a>
              <p className="mt-2 text-xs text-slate-600">Video lưu trên SharePoint; có thể cần đăng nhập tài khoản được cấp quyền. Phát trực tiếp trong ứng dụng chưa được xác minh.</p>
            </div>
          ))}
          <div className="space-y-3 text-sm text-slate-700">{reeManifest.learn.introduction.map((item) => <p key={item}>{item}</p>)}</div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{reeManifest.learn.layers.map((layer, index) => (
            <div key={layer.label} className="rounded-xl border border-emblue/20 bg-emblue/5 p-4">
              <p className="text-xs font-bold text-emblue">Lớp {index + 1}</p>
              <h3 className="mt-1 font-semibold text-master">{layer.label}</h3>
              <p className="mt-2 text-sm text-slate-700">{layer.text}</p>
              <p className="mt-2 text-xs text-slate-600">{layer.language}</p>
            </div>
          ))}</div>
          <h3 className="mt-6 font-semibold text-master">Respond theo dạng câu hỏi</h3>
          <div className="mt-3 space-y-3">{reeManifest.learn.respondByQuestion.map((item) => (
            <div key={item.kind} className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-master">{item.kind}</p>
              <p className="mt-1">{item.method}</p>
              <p className="mt-2 text-slate-600">{item.example}</p>
            </div>
          ))}</div>
          <h3 className="mt-6 font-semibold text-master">Ví dụ trước/sau khi áp dụng REE</h3>
          <div className="mt-3 space-y-4">{reeManifest.learn.examples.map((example) => (
            <div key={example.label} className="rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-semibold text-master">{example.label}: {example.question}</p>
              <p className="mt-2 text-slate-500">Trước: {example.before}</p>
              <div className="mt-3 border-l-4 border-emblue pl-3">
                <p className="font-semibold">Sau:</p>
                {example.after.map((line) => <p key={line} className="mt-1">{line}</p>)}
              </div>
            </div>
          ))}</div>

          <p className="mt-5 font-medium text-master">{reeManifest.learn.conclusion}</p>
          {canEditStage && <NextButton disabled={busy} onClick={() => void progress('Learn', { acknowledged: true })}>Tiếp tục đến Practice</NextButton>}
        </>}

        {viewStage === 'Practice' && <>
          <p className="text-sm text-slate-700">{reeManifest.practice.introduction}</p>
          <h3 className="mt-6 font-semibold text-master">{reeManifest.practice.mcq.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{reeManifest.practice.mcq.instruction}</p>
          <InteractionRegistry
            definition={{ type: 'multiple_choice', id: 'ree-mcq', questions: reeManifest.practice.mcq.questions }}
            response={mcq} onChange={(next) => setMcq(next as McqResponse)}
            result={mcqAttempt?.result} disabled={!canEditStage} />
          {canEditStage && <button type="button" disabled={busy || !validReeActivityResponse('ree-mcq', mcq)}
            onClick={() => void submitPractice('ree-mcq', mcq)}
            className="mt-4 rounded-lg bg-master px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Nộp Bài 1 và xem giải thích</button>}
          <h3 className="mt-8 font-semibold text-master">{reeManifest.practice.matching.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{reeManifest.practice.matching.instruction}</p>
          <InteractionRegistry
            definition={{ type: 'matching', id: 'ree-matching',
              responds: reeManifest.practice.matching.responds,
              explains: reeManifest.practice.matching.explains,
              examples: reeManifest.practice.matching.examples }}
            response={matching} onChange={(next) => setMatching(next as MatchingResponse)}
            result={matchingAttempt?.result} disabled={!canEditStage} />
          {canEditStage && <button type="button" disabled={busy || !validReeActivityResponse('ree-matching', matching)}
            onClick={() => void submitPractice('ree-matching', matching)}
            className="mt-4 rounded-lg bg-master px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Nộp Bài 2 và xem giải thích</button>}
          {matchingAttempt && <p className="mt-4 text-sm text-slate-600">{reeManifest.practice.matching.conclusion}</p>}
          {canEditStage && <NextButton disabled={busy || !mcqAttempt || !matchingAttempt}
            onClick={() => void progress('Practice', { mcq, matching })}>Tiếp tục đến Apply</NextButton>}
          {activities.length > 0 && <p className="mt-3 text-xs text-slate-500">Đã lưu {activities.length} lượt Practice; các lần thử lại được giữ trong lịch sử.</p>}
        </>}

        {viewStage === 'Apply' && <>
          <p className="mb-4 text-sm text-slate-700">{reeManifest.apply.introduction}</p>
          <div className="space-y-4">{reeManifest.apply.prompts.map((prompt) => canEditStage ? (
            <AudioPrompt key={prompt.id} attemptId={attempt.id} taskId={task.id} studentId={profile.id}
              promptId={prompt.id} prompt={prompt.text} recordings={recordings.filter((item) => item.attempt_id === attempt.id)}
              onSaved={() => refreshEvidence(attempt)} />
          ) : (
            <div key={prompt.id}><p className="mb-1 text-sm font-medium">{prompt.text}</p>
              {latestRecording(recordings,prompt.id) && <SavedRecording recording={latestRecording(recordings,prompt.id)!} />}</div>
          ))}</div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-master">Nhắc nhanh trước khi ghi âm (lấy từ phần Learn):</p>
            {reeManifest.apply.reminder.map((item) => <p key={item} className="mt-2">{item}</p>)}
          </div>
          {canEditStage && <NextButton disabled={busy || reeManifest.apply.prompts.some((p) => !latestRecording(recordings,p.id))}
            onClick={() => void progress('Apply')}>Tiếp tục đến Reflect</NextButton>}
        </>}

        {viewStage === 'Reflect' && <>
          <p className="mb-4 text-sm text-slate-700">{reeManifest.reflect.introduction}</p>
          <div className="space-y-3">{reeManifest.apply.prompts.map((prompt) => {
            const recording = latestRecording(recordings, prompt.id);
            return recording && <div key={prompt.id}><p className="mb-1 text-sm font-medium">{prompt.text}</p><SavedRecording recording={recording} /></div>;
          })}</div>
          <div className="mt-5 space-y-3">{reeManifest.reflect.items.map((item,index) => (
            <label key={item} className="flex gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input type="checkbox" checked={checklist[index]} disabled={!canEditStage}
                onChange={(event) => {
                  const next = [...checklist]; next[index] = event.target.checked; setChecklist(next);
                  void saveModuleProgress(attempt.id,'Reflect',{ checklist: next, reviewed: false },false)
                    .catch(() => setError('Chưa lưu được checklist. Thử lại khi có mạng.'));
                }} />
              <span>{item}</span>
            </label>
          ))}</div>
          {canEditStage && <NextButton disabled={busy} onClick={() => void progress('Reflect', { checklist, reviewed: true })}>Tiếp tục đến Verify</NextButton>}
        </>}

        {viewStage === 'Verify' && <>
          <p className="mb-3 text-sm text-slate-700">{reeManifest.verify.introduction}</p>
          {reeManifest.verify.guidance.map((line) => <p key={line} className="mb-2 text-sm text-slate-600">{line}</p>)}
          {latestRecording(recordings,'discover') && <div className="my-4">
            <p className="mb-2 text-sm font-semibold text-master">Bản Discover để so sánh</p>
            {latestRecording(recordings,'discover')?.attempt_id !== attempt.id && <p className="mb-2 text-xs text-slate-500">Bằng chứng giữ từ lượt học trước</p>}
            <SavedRecording recording={latestRecording(recordings,'discover')!} />
          </div>}
          {canEditStage && <AudioPrompt attemptId={attempt.id} taskId={task.id} studentId={profile.id}
            promptId="verify" prompt={reeManifest.verify.prompt} recordings={recordings.filter((item) => item.attempt_id === attempt.id)}
            onSaved={() => refreshEvidence(attempt)} />}
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-master">Điều kiện đạt</p>
            <p className="mt-1">Từ 6/8 điểm trở lên, không tiêu chí nào bằng 0, và bản ghi Verify dài 20–30 giây. Coach quyết định cuối cùng.</p>
          </div>
          {canEditStage && <NextButton disabled={busy || !latestCurrentRecording(recordings,'verify',attempt.id)} onClick={() => void submitVerify()}>Nộp Verify cho coach</NextButton>}
          {submission?.feedback_text && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-master">Phản hồi của coach</p>
            <p className="mt-2 whitespace-pre-wrap">{submission.feedback_text}</p>
            {submission.feedback_score !== null && <p className="mt-2">Điểm: {submission.feedback_score}/8</p>}
          </div>}
          {revisions.length > 0 && <RevisionHistory revisions={revisions} />}
        </>}
      </main>
    </div>
  );
}

function NextButton({ children, onClick, disabled }: {
  children: string; onClick: () => void; disabled: boolean;
}) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className="mt-6 w-full rounded-xl bg-emblue px-4 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto">
    {children}
  </button>;
}
