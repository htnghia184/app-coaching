import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createSubmission, createTask, getActiveEnrollmentForStudent, listEnrollmentsForCoach, listSubmissionRevisions, listSubmissionsForTasks, listTasksForPlans, listWeeklyPlans, reviewSubmission, updateOwnSubmission } from '../lib/coachingService';
import type { CoachingTask, EnrollmentWithPeople, Submission, WeeklyPlan } from '../lib/types';
import { supabase } from '../lib/supabaseClient';
import { GenericActivityPreview } from '../modules/GenericActivityPreview';
import { resolveAssignedModuleMedia } from '../modules/moduleMedia';
import type { PublicActivity } from '../modules/genericEngine';
import { assignGenericModule, completeGenericStage, getGenericAssignment, listGenericVersions, requireLocalPilot, saveGenericRecording, saveGenericResponse, startGenericAttempt, submitGenericVerify, type GenericAttempt, type GenericVersion } from '../lib/genericPilotService';

const input = 'mt-1 w-full rounded border border-slate-300 p-2';
function check<T>(result: { data: T | null; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); if (result.data === null) throw new Error('No local result.'); return result.data; }

export function LocalIntegratedPilot() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithPeople[]>([]);
  const [selected, setSelected] = useState('');
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [tasks, setTasks] = useState<CoachingTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [versions, setVersions] = useState<GenericVersion[]>([]);
  const [outcomes, setOutcomes] = useState<{ id: string; version: number; statement: string }[]>([]);
  const [outcomeId, setOutcomeId] = useState('');
  const [moduleKey, setModuleKey] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('');
  const [taskId, setTaskId] = useState('');
  const [assignment, setAssignment] = useState<Awaited<ReturnType<typeof getGenericAssignment>>>(null);
  const [attempt, setAttempt] = useState<GenericAttempt | null>(null);
  const [moduleAttempts, setModuleAttempts] = useState<GenericAttempt[]>([]);
  const [rubricScores, setRubricScores] = useState([2, 2, 1, 1]);
  const [passedItems, setPassedItems] = useState<string[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  const [recordingFiles, setRecordingFiles] = useState<Record<string, File>>({});
  const [recordingDurations, setRecordingDurations] = useState<Record<string, string>>({});
  const [resolvedMedia, setResolvedMedia] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [assessment, setAssessment] = useState('developing');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const local = import.meta.env.DEV && /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(import.meta.env.VITE_SUPABASE_URL ?? '');
  const enrollment = enrollments.find(item => item.id === selected);
  const currentTask = tasks.find(item => item.id === taskId);
  const currentSubmission = submissions.find(item => item.task_id === taskId);
  const currentVersion = versions.find(item => item.module_key === moduleKey);
  const pendingModuleAttempt = moduleAttempts.find(item => item.status === 'awaiting_review');

  const load = useCallback(async () => {
    if (!profile || !local) return;
    try {
      requireLocalPilot();
      const rows = profile.role === 'teacher' ? await listEnrollmentsForCoach(profile.id) : profile.role === 'student' ? [await getActiveEnrollmentForStudent(profile.id)].filter((x): x is EnrollmentWithPeople => Boolean(x)) : [];
      setEnrollments(rows);
      const enrollmentId = selected && rows.some(item => item.id === selected) ? selected : rows[0]?.id ?? '';
      setSelected(enrollmentId);
      const loadedPlans = enrollmentId ? await listWeeklyPlans(enrollmentId) : [];
      setPlans(loadedPlans);
      const loadedTasks = await listTasksForPlans(loadedPlans.map(item => item.id));
      setTasks(loadedTasks);
      setSubmissions(await listSubmissionsForTasks(loadedTasks.map(item => item.id)));
      if (profile.role === 'teacher') {
        setVersions(await listGenericVersions());
        const catalog = check<{ id: string; version: number; statement: string }[]>(await supabase.from('coaching_learning_outcomes').select('id,version,statement').eq('active', true));
        setOutcomes(catalog);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load local pilot.'); }
  }, [profile, local, selected]);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); await load(); setMessage('Saved to Supabase Local.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Local action failed.'); }
    finally { setBusy(false); }
  };
  const chooseTask = async (id: string) => {
    setTaskId(id); setAttempt(null); setResponses({}); setRecordings({});
    try { setAssignment(await getGenericAssignment(id)); setModuleAttempts(check<GenericAttempt[]>(await supabase.from('coaching_generic_attempts').select('*').eq('task_id', id).order('attempt_number', { ascending: false }))); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open assignment.'); }
  };
  if (!local) return <main className="page-container"><p role="alert">This authenticated pilot is available only with Supabase Local in development.</p></main>;
  if (!profile) return <main className="page-container"><p>Sign in with a disposable local coach or learner account.</p></main>;
  return <main className="page-container space-y-5">
    <header className="rounded-xl bg-master p-5 text-white"><p className="text-xs font-bold uppercase">Supabase Local · authenticated technical pilot</p><h1 className="mt-2 text-2xl font-bold">Integrated Coaching Pilot</h1><p className="mt-2 text-sm">{profile.role} · {profile.email}</p></header>
    {profile.role === 'teacher' && <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="font-semibold">Coach assignment and assessment</h2>
      <label className="mt-3 block text-sm">Learner<select className={input} value={selected} onChange={event => setSelected(event.target.value)}>{enrollments.map(item => <option key={item.id} value={item.id}>{item.student?.full_name || item.student?.email || item.student_id}</option>)}</select></label>
      <label className="mt-3 block text-sm">Learning outcome<select className={input} value={outcomeId} onChange={event => setOutcomeId(event.target.value)}><option value="">Select outcome</option>{outcomes.map(item => <option key={item.id} value={item.id}>{item.statement}</option>)}</select></label>
      <label className="mt-3 block text-sm">Generic module<select className={input} value={moduleKey} onChange={event => setModuleKey(event.target.value)}><option value="">Direct task</option>{versions.map(item => <option key={`${item.module_key}-${item.content_version}`} value={item.module_key}>{item.manifest.title} · v{item.content_version}</option>)}</select></label>
      <label className="mt-3 block text-sm">Task title<input className={input} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Reason for learner<input className={input} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Planning minutes<input className={input} type="number" min="1" max="480" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
      <button disabled={busy} className="mt-3 rounded bg-master px-4 py-2 text-white" onClick={() => void run(async () => {
        if (!enrollment || !plans[0] || !outcomeId || !title.trim() || !reason.trim() || !Number.isInteger(Number(minutes)) || Number(minutes) < 1) throw new Error('Select learner and outcome, then enter title, reason and minutes.');
        const version = moduleKey ? currentVersion : null;
        if (moduleKey && !version) throw new Error('Choose a published module version.');
        check(await supabase.rpc('set_coaching_outcome_priority', { p_enrollment: enrollment.id, p_outcome: outcomeId, p_version: 1, p_priority: 1, p_rationale: reason, p_checkpoint: null }));
        const task = await createTask({ weekly_plan_id: plans[0].id, task_type: version ? 'lesson' : 'text', module_id: version?.module_id ?? null, title, instructions: reason, sequence: tasks.length + 1, due_at: null, is_required: true });
        if (version) await assignGenericModule(task.id, version.module_key, version.content_version);
        check(await supabase.rpc('link_coaching_task_outcome', { p_task: task.id, p_outcome: outcomeId, p_version: 1, p_evidence_expected: version ? 'module_submission' : 'task_submission' }));
        check(await supabase.rpc('record_coaching_work', { p_enrollment: enrollment.id, p_type: 'planning', p_minutes: Number(minutes), p_day: new Date().toISOString().slice(0, 10), p_note: reason }));
        setTaskId(task.id);
      })}>Assign next task</button>
      <h3 className="mt-6 font-semibold">Tasks and reviews</h3><div className="mt-2 space-y-2">{tasks.map(task => <button key={task.id} className="block w-full rounded border p-3 text-left text-sm" onClick={() => void chooseTask(task.id)}>{task.title} · {submissions.find(item => item.task_id === task.id)?.status ?? 'awaiting submission'}</button>)}</div>
      {currentTask && <div className="mt-4 rounded border p-4"><p className="font-medium">{currentTask.title}</p><p className="text-sm">{currentSubmission?.text_response ?? 'No submission yet'}</p>{currentSubmission && <><label className="mt-2 block text-sm">Feedback<textarea className={input} value={feedback} onChange={event => setFeedback(event.target.value)} /></label><button disabled={busy} className="mt-2 rounded border px-3 py-2" onClick={() => void run(async () => { await reviewSubmission({ submission_id: currentSubmission.id, feedback_text: feedback, feedback_score: null, request_revision: true }); })}>Request revision</button><button disabled={busy} className="ml-2 mt-2 rounded border px-3 py-2" onClick={() => void run(async () => { await reviewSubmission({ submission_id: currentSubmission.id, feedback_text: feedback, feedback_score: null, request_revision: false }); })}>Accept review</button><label className="mt-3 block text-sm">LO status<select className={input} value={assessment} onChange={event => setAssessment(event.target.value)}>{['emerging','developing','demonstrated','needs_recheck'].map(value => <option key={value}>{value}</option>)}</select></label><button disabled={busy} className="mt-2 rounded bg-master px-3 py-2 text-white" onClick={() => void run(async () => {
        if (!enrollment || !outcomeId || !feedback.trim() || !Number.isInteger(Number(minutes)) || Number(minutes) < 1) throw new Error('Select LO, feedback and actual review minutes.');
        const revisions = await listSubmissionRevisions([currentSubmission.id]); const latest = revisions[0]; if (!latest) throw new Error('No submitted revision.');
        const evidence = check<{ id: string }>(await supabase.rpc('record_coaching_outcome_evidence', { p_enrollment: enrollment.id, p_outcome: outcomeId, p_version: 1, p_revision: latest.id, p_source_type: currentTask.module_id ? 'module_submission' : 'task_submission', p_module: currentTask.module_id, p_module_version: assignment?.assignment.content_version ?? null, p_session: null, p_summary: latest.text_response ?? currentTask.title }));
        check(await supabase.rpc('record_coaching_outcome_assessment', { p_enrollment: enrollment.id, p_outcome: outcomeId, p_version: 1, p_status: assessment, p_rationale: reason || feedback, p_feedback: feedback, p_evidence_ids: [evidence.id] }));
        check(await supabase.rpc('record_coaching_work', { p_enrollment: enrollment.id, p_type: 'review', p_minutes: Number(minutes), p_day: new Date().toISOString().slice(0, 10), p_note: feedback }));
      })}>Record LO assessment</button></>}</div>}
    </section>}
    {profile.role === 'teacher' && assignment && pendingModuleAttempt && <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="font-semibold">Module Verify review</h2><p className="mt-1 text-sm">{assignment.version.manifest.title} · attempt {pendingModuleAttempt.id.slice(0, 8)}</p>
      {assignment.version.manifest.verifyPolicy.kind === 'rubric_sum' ? <div className="mt-3 grid gap-2 sm:grid-cols-4">{assignment.version.manifest.verifyPolicy.criteria.map((criterion, index) => <label key={criterion} className="text-sm">{criterion}<input className={input} type="number" min="0" max="2" value={rubricScores[index]} onChange={event => setRubricScores(old => old.map((value, i) => i === index ? Number(event.target.value) : value))} /></label>)}</div> : <div className="mt-3 space-y-2">{assignment.version.manifest.verifyPolicy.itemIds.map(id => <label key={id} className="flex gap-2 text-sm"><input type="checkbox" checked={passedItems.includes(id)} onChange={event => setPassedItems(old => event.target.checked ? [...old, id] : old.filter(value => value !== id))} />{id} passed</label>)}</div>}
      <button className="mt-3 rounded border px-3 py-2" onClick={() => void run(async () => {
        const policy = assignment.version.manifest.verifyPolicy;
        const review = policy.kind === 'rubric_sum' ? { scores: rubricScores } : { reviewedItems: policy.itemIds, passedItems, repeatedItems: [] };
        check(await supabase.rpc('review_generic_coaching_verify', { p_attempt: pendingModuleAttempt.id, p_review: review }));
        await chooseTask(assignment.assignment.task_id);
      })}>Record module Verify</button><p className="mt-2 text-xs text-slate-500">Module completion is separate from LO assessment.</p>
    </section>}
    {profile.role === 'student' && <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="font-semibold">Your next action</h2><p className="text-sm text-slate-600">{enrollment?.goal_label}</p><div className="mt-3 space-y-2">{tasks.map(task => <button key={task.id} className="block w-full rounded border p-3 text-left text-sm" onClick={() => void chooseTask(task.id)}>{task.title} · {submissions.find(item => item.task_id === task.id)?.status ?? 'To do'}</button>)}</div>
      {currentTask && <div className="mt-4"><h3 className="font-medium">{currentTask.title}</h3><p className="text-sm text-slate-600">Why: {currentTask.instructions}</p>{assignment && <><p className="mt-2 text-sm">{assignment.version.manifest.title} · version {assignment.assignment.content_version}</p><button className="mt-2 rounded border px-3 py-2" onClick={() => void run(async () => { setAttempt(await startGenericAttempt(currentTask.id)); })}>Start or resume module</button>{attempt && assignment.version.manifest.stages.map(stage => <div key={stage.id} className="mt-4 rounded border p-4"><h4 className="font-semibold">{stage.title}</h4>{stage.activities.map((activity: PublicActivity) => <div key={activity.id} className="mt-3">{activity.type === 'media' ? <div><p className="text-sm">{activity.title}</p><button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => void run(async () => { const ref = String(activity.payload.assetRef); const media = await resolveAssignedModuleMedia(ref, currentTask.id, assignment.assignment.module_key, assignment.assignment.content_version); setResolvedMedia(old => ({ ...old, [ref]: media.url })); })}>Load assigned media</button>{resolvedMedia[String(activity.payload.assetRef)] && <iframe className="mt-2 aspect-video w-full" title={activity.title} src={resolvedMedia[String(activity.payload.assetRef)]} />}</div> : <GenericActivityPreview activity={activity} responses={responses} onResponse={(id, value) => setResponses(old => ({ ...old, [id]: value }))} recordings={recordings} onRecording={(id, objectUrl) => { setRecordings(old => ({ ...old, [id]: objectUrl })); }} />}{activity.type === 'recording' && (activity.payload.prompts as { id: string }[]).map(prompt => <div key={prompt.id} className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-sm">Attach synthetic WebM for {prompt.id}<input className={input} type="file" accept="audio/webm" onChange={event => { const file = event.target.files?.[0]; if (file) setRecordingFiles(old => ({ ...old, [prompt.id]: file })); }} /></label><label className="text-sm">Duration in seconds<input className={input} type="number" min="1" max="600" value={recordingDurations[prompt.id] ?? ''} onChange={event => setRecordingDurations(old => ({ ...old, [prompt.id]: event.target.value }))} /></label></div>)}<button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => void run(async () => { if (activity.type === 'recording') { for (const prompt of activity.payload.prompts as { id: string }[]) { const file = recordingFiles[prompt.id]; const objectUrl = recordings[prompt.id]; if (!file && !objectUrl) throw new Error(`Attach or record ${prompt.id} first.`); const seconds = Number(recordingDurations[prompt.id]); if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) throw new Error(`Enter the duration for ${prompt.id}.`); const blob = file ? new Blob([file], { type: 'audio/webm' }) : new Blob([await (await fetch(objectUrl)).blob()], { type: 'audio/webm' }); const path = `${profile.id}/${currentTask.id}/${attempt.id}/${crypto.randomUUID()}.webm`; check(await supabase.storage.from('coaching-submissions').upload(path, blob, { contentType: 'audio/webm' })); await saveGenericRecording(attempt.id, prompt.id, path, seconds); } } else await saveGenericResponse(attempt.id, activity.id, responses); })}>Save {activity.type}</button></div>)}<button className="mt-3 rounded border px-3 py-2" onClick={() => void run(async () => { setAttempt(await completeGenericStage(attempt.id, stage.id)); })}>Complete stage</button></div>)}</>}
        <label className="mt-4 block text-sm">Your answer or revision<textarea className={input} value={answer} onChange={event => setAnswer(event.target.value)} /></label><button disabled={busy} className="mt-2 rounded bg-master px-4 py-2 text-white" onClick={() => void run(async () => { if (!answer.trim()) throw new Error('Enter your response.'); const submission = currentSubmission ? await updateOwnSubmission({ submission_id: currentSubmission.id, text_response: answer, storage_path: null, duration_seconds: null, submit: true }) : await createSubmission({ task_id: currentTask.id, student_id: profile.id, text_response: answer, storage_path: null, duration_seconds: null, submit: true }); if (attempt) { const revisions = await listSubmissionRevisions([submission.id]); const latest = revisions[0]; if (!latest) throw new Error('Revision missing.'); await submitGenericVerify(attempt.id, latest.id); } })}>Submit evidence</button>{currentSubmission?.feedback_text && <p className="mt-3 rounded bg-sky-50 p-3 text-sm">Coach feedback: {currentSubmission.feedback_text}</p>}</div>}
    </section>}
    {message && <p role="status" className="rounded bg-sky-50 p-3 text-sm">{message}</p>}
  </main>;
}
