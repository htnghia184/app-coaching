import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { createSubmission, createTask, getActiveEnrollmentForStudent, listEnrollmentsForCoach, listSubmissionRevisions, listSubmissionsForTasks, listTasksForPlans, listWeeklyPlans, reviewSubmission, updateOwnSubmission } from '../lib/coachingService';
import type { CoachingTask, EnrollmentWithPeople, Submission, WeeklyPlan } from '../lib/types';
import { supabase } from '../lib/supabaseClient';
import { GenericActivityPreview } from '../modules/GenericActivityPreview';
import { resolveAssignedModuleMedia } from '../modules/moduleMedia';
import type { PublicActivity } from '../modules/genericEngine';
import { assignGenericModule, completeGenericStage, getGenericAssignment, listGenericVersions, requireLocalPilot, saveGenericRecording, saveGenericResponse, startGenericAttempt, submitGenericVerifyAtomic, type GenericAttempt, type GenericVersion } from '../lib/genericPilotService';

const input = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-emblue focus:outline-none focus:ring-1 focus:ring-emblue';
function check<T>(result: { data: T | null; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); if (result.data === null) throw new Error('No local result.'); return result.data; }

export function LocalIntegratedPilot() {
  const verifyRequestKeys = useRef<Record<string,string>>({});
  const { profile, loading, signOut } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithPeople[]>([]);
  const [selected, setSelected] = useState('');
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [tasks, setTasks] = useState<CoachingTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [versions, setVersions] = useState<GenericVersion[]>([]);
  const [outcomes, setOutcomes] = useState<{ id: string; version: number; statement: string }[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [reviewKey, setReviewKey] = useState('');
  const [priorities, setPriorities] = useState<{outcome_id:string;outcome_version:number;priority:number;rationale:string}[]>([]);
  const [taskLinks, setTaskLinks] = useState<{task_id:string;outcome_id:string;outcome_version:number}[]>([]);
  const [priorityKey,setPriorityKey]=useState('');
  const [priorityReason,setPriorityReason]=useState('');
  const [priorityRank,setPriorityRank]=useState('1');
  const [moduleKey, setModuleKey] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('');
  const [taskId, setTaskId] = useState('');
  const [assignment, setAssignment] = useState<Awaited<ReturnType<typeof getGenericAssignment>>>(null);
  const [attempt, setAttempt] = useState<GenericAttempt | null>(null);
  const [moduleAttempts, setModuleAttempts] = useState<GenericAttempt[]>([]);
  const [inheritedPrompts, setInheritedPrompts] = useState<string[]>([]);
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
  const outcomeKey = (item:{id:string;version:number})=>item.id+':'+item.version;
  const linkKey = (item:{outcome_id:string;outcome_version:number})=>item.outcome_id+':'+item.outcome_version;
  const selectedTargets = outcomes.filter(item=>targetKeys.includes(outcomeKey(item)));
  const reviewOutcome = outcomes.find(item=>outcomeKey(item)===reviewKey);
  const linkedOutcomes = taskLinks.filter(item=>item.task_id===currentTask?.id);
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
        setPriorities(enrollmentId ? check(await supabase.from('coaching_enrollment_outcomes').select('outcome_id,outcome_version,priority,rationale').eq('enrollment_id',enrollmentId).eq('active',true).order('priority')) : []);
        setTaskLinks(loadedTasks.length ? check(await supabase.from('coaching_task_outcomes').select('task_id,outcome_id,outcome_version').in('task_id',loadedTasks.map(t=>t.id))) : []);
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
    setTaskId(id); setReviewKey(''); setFeedback(''); setAssignment(null); setModuleAttempts([]); setAttempt(null); setInheritedPrompts([]); setResponses({}); setRecordings({});
    try { setAssignment(await getGenericAssignment(id)); setModuleAttempts(check<GenericAttempt[]>(await supabase.from('coaching_generic_attempts').select('*').eq('task_id', id).order('attempt_number', { ascending: false }))); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open assignment.'); }
  };
  if (!local) return <main className="page-container"><p role="alert">This authenticated pilot is available only with Supabase Local in development.</p></main>;
  if (loading) return <main className="page-container"><p>Loading local account…</p></main>;
  if (!profile) return <main className="page-container space-y-3"><p>Sign in with a disposable local coach or learner account.</p><Link to="/login" className="text-master underline">Sign in</Link></main>;
  if (profile.role !== 'teacher' && profile.role !== 'student') return <main className="mx-auto max-w-3xl space-y-5 p-6"><header className="rounded-3xl bg-master p-6 text-white"><p className="text-xs uppercase tracking-widest text-sky-200">E-Master · Supabase Local</p><h1 className="mt-2 text-2xl font-bold">Local review hub</h1><p className="mt-2 text-sm">{profile.email} · {profile.role}</p></header><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold text-master">Student and coach pilot</h2><p className="mt-2 text-sm text-slate-600">Use a disposable coach or learner account for live workflow testing. Admins can review unpublished learning content without changing learner records.</p>{profile.role==='admin'&&<Link to="/local-private-drafts" className="mt-4 inline-block rounded-xl bg-master px-5 py-3 text-sm font-semibold text-white">Open Admin Student Demo →</Link>}<button className="ml-3 mt-4 text-sm underline" onClick={()=>void signOut()}>Switch account</button></div></main>;
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-8">
    <header className="rounded-3xl bg-master p-6 text-white sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-sky-200">E-Master · Supabase Local</p><h1 className="mt-2 text-3xl font-bold">{profile.role==='teacher'?'Coach Workspace':'My learning workspace'}</h1><p className="mt-2 text-sm text-sky-100">{profile.email} · Disposable pilot account</p></div><button className="rounded-xl border border-white/40 px-4 py-2 text-sm" onClick={()=>void signOut()}>Switch account</button></div><p className="mt-4 text-xs text-sky-100">Local technical pilot · No production records</p></header>
    {profile.role==='teacher'&&<div className="grid gap-3 sm:grid-cols-3">{[{label:'Assigned learners',value:enrollments.length},{label:'Tasks for selected learner',value:tasks.length},{label:'Awaiting review',value:submissions.filter(item=>item.status==='submitted').length}].map(metric=><div key={metric.label} className="rounded-2xl border bg-white p-5"><p className="text-xs font-semibold text-slate-500">{metric.label}</p><p className="mt-2 text-3xl font-bold text-master">{metric.value}</p></div>)}</div>}
    {profile.role === 'teacher' && <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-7"><h2 className="text-xl font-bold text-master">Coach assignment and assessment</h2><p className="mt-2 text-sm text-slate-500">Select a learner, prescribe the next action and review submitted evidence.</p>
      <label className="mt-3 block text-sm">Learner<select className={input} value={selected} onChange={event => { setSelected(event.target.value); setTargetKeys([]); setReviewKey(''); setPriorityKey(''); setTaskId(''); setAssignment(null); setModuleAttempts([]); setPriorities([]); setTaskLinks([]); }}>{enrollments.map(item => <option key={item.id} value={item.id}>{item.student?.full_name || item.student?.email || item.student_id}</option>)}</select></label>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="font-bold text-master">01 · Learner LO priorities</h3><p className="mt-1 text-sm text-slate-500">Set priorities independently of tasks and modules.</p>
        {priorities.length===0&&<p className="mt-3 text-sm">No active priorities yet.</p>}
        {priorities.map(item=><div key={linkKey(item)} className="mt-2 rounded-xl bg-white p-3 text-sm"><strong>Priority {item.priority} · {outcomes.find(o=>outcomeKey(o)===linkKey(item))?.statement??linkKey(item)}</strong><p className="mt-1 text-slate-600">{item.rationale}</p></div>)}
        <label className="mt-4 block text-sm">Learning outcome<select className={input} value={priorityKey} onChange={e=>setPriorityKey(e.target.value)}><option value="">Select outcome</option>{outcomes.map(o=><option key={outcomeKey(o)} value={outcomeKey(o)}>{o.statement} · v{o.version}</option>)}</select></label>
        <label className="mt-3 block text-sm">Priority rank<input className={input} type="number" min="1" value={priorityRank} onChange={e=>setPriorityRank(e.target.value)}/></label>
        <label className="mt-3 block text-sm">Diagnostic rationale<textarea className={input} value={priorityReason} onChange={e=>setPriorityReason(e.target.value)}/></label>
        <button disabled={busy||!enrollment} className="mt-3 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-master" onClick={()=>void run(async()=>{const o=outcomes.find(item=>outcomeKey(item)===priorityKey);if(!enrollment||!o||!priorityReason.trim()||!Number.isInteger(Number(priorityRank))||Number(priorityRank)<1)throw new Error('Select outcome, rank and diagnostic rationale.');check(await supabase.rpc('set_coaching_outcome_priority',{p_enrollment:enrollment.id,p_outcome:o.id,p_version:o.version,p_priority:Number(priorityRank),p_rationale:priorityReason,p_checkpoint:null}));})}>Save LO priority</button>
      </section>
      <h3 className="mt-6 font-bold text-master">02 · Prescribe next task</h3>
      <fieldset className="mt-3 space-y-2"><legend className="text-sm font-semibold">Target learning outcomes (optional, select multiple)</legend>{priorities.map(item=><label key={linkKey(item)} className="flex gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={targetKeys.includes(linkKey(item))} onChange={e=>setTargetKeys(old=>e.target.checked?[...old,linkKey(item)]:old.filter(k=>k!==linkKey(item)))}/>{outcomes.find(o=>outcomeKey(o)===linkKey(item))?.statement??linkKey(item)}</label>)}</fieldset>
      <label className="mt-3 block text-sm">Optional module resource<select className={input} value={moduleKey} onChange={event => setModuleKey(event.target.value)}><option value="">Direct task</option>{versions.map(item => <option key={`${item.module_key}-${item.content_version}`} value={item.module_key}>{item.manifest.title} · v{item.content_version}</option>)}</select></label>
      <label className="mt-3 block text-sm">Task title<input className={input} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Reason for learner<input className={input} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Planning minutes<input className={input} type="number" min="1" max="480" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
      <button disabled={busy} className="mt-4 rounded-xl bg-master px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void run(async () => {
        if (!enrollment || !plans[0] || !title.trim() || !reason.trim() || !Number.isInteger(Number(minutes)) || Number(minutes) < 1) throw new Error('Select learner and enter title, reason and minutes.');
        const version = moduleKey ? currentVersion : null;
        if (moduleKey && !version) throw new Error('Choose a published module version.');
        if(selectedTargets.length!==targetKeys.length||selectedTargets.some(o=>!priorities.some(p=>linkKey(p)===outcomeKey(o)))) throw new Error('Task targets must be active learner priorities.');
        const task = await createTask({ weekly_plan_id: plans[0].id, task_type: version ? 'lesson' : 'text', module_id: version?.module_id ?? null, title, instructions: reason, sequence: tasks.length + 1, due_at: null, is_required: true });
        if (version) await assignGenericModule(task.id, version.module_key, version.content_version);
        for(const o of selectedTargets) check(await supabase.rpc('link_coaching_task_outcome', { p_task: task.id, p_outcome: o.id, p_version: o.version, p_evidence_expected: version ? 'module_submission' : 'task_submission' }));
        check(await supabase.rpc('record_coaching_work', { p_enrollment: enrollment.id, p_type: 'planning', p_minutes: Number(minutes), p_day: new Date().toISOString().slice(0, 10), p_note: reason }));
        setTaskId(task.id);
      })}>Assign next task</button>
      <h3 className="mt-8 border-t pt-6 text-lg font-bold text-master">Tasks and reviews</h3><p className="mt-1 text-sm text-slate-500">Select a task to inspect the submission and record feedback.</p><div className="mt-2 space-y-2">{tasks.map(task => <button key={task.id} className={`block w-full rounded-xl border-2 p-4 text-left text-sm ${taskId===task.id?'border-emblue bg-sky-50':'border-slate-200 bg-white'}`} onClick={() => void chooseTask(task.id)}>{task.title} · {submissions.find(item => item.task_id === task.id)?.status ?? 'awaiting submission'}</button>)}</div>
      {currentTask && <div className="mt-5 rounded-2xl border bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-emblue">Selected evidence</p><p className="mt-2 text-lg font-bold text-master">{currentTask.title}</p><p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm">{currentSubmission?.text_response ?? 'No submission yet'}</p>{currentSubmission && <><label className="mt-2 block text-sm">Feedback<textarea className={input} value={feedback} onChange={event => setFeedback(event.target.value)} /></label><button disabled={busy} className="mt-2 rounded border px-3 py-2" onClick={() => void run(async () => { await reviewSubmission({ submission_id: currentSubmission.id, feedback_text: feedback, feedback_score: null, request_revision: true }); })}>Request revision</button><button disabled={busy} className="ml-2 mt-2 rounded border px-3 py-2" onClick={() => void run(async () => { await reviewSubmission({ submission_id: currentSubmission.id, feedback_text: feedback, feedback_score: null, request_revision: false }); })}>Accept review</button><div className="mt-4 rounded-xl border bg-white p-4"><p className="text-sm font-semibold text-master">03 · Assess a specific outcome</p><p className="mt-1 text-xs text-slate-500">Assess each outcome separately. A reviewed task is not automatic mastery.</p><label className="mt-3 block text-sm">Outcome<select className={input} value={reviewKey} onChange={e=>setReviewKey(e.target.value)}><option value="">Select outcome to assess</option>{linkedOutcomes.map(link=><option key={linkKey(link)} value={linkKey(link)}>{outcomes.find(o=>outcomeKey(o)===linkKey(link))?.statement??linkKey(link)}</option>)}</select></label></div><label className="mt-3 block text-sm">LO status<select className={input} value={assessment} onChange={event => setAssessment(event.target.value)}>{['emerging','developing','demonstrated','needs_recheck'].map(value => <option key={value}>{value}</option>)}</select></label><button disabled={busy} className="mt-3 rounded-xl bg-master px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void run(async () => {
        if (!enrollment || !reviewOutcome || !linkedOutcomes.some(link=>linkKey(link)===reviewKey) || !feedback.trim() || !Number.isInteger(Number(minutes)) || Number(minutes) < 1) throw new Error('Select LO, feedback and actual review minutes.');
        const revisions = await listSubmissionRevisions([currentSubmission.id]); const latest = revisions[0]; if (!latest) throw new Error('No submitted revision.');
        const evidence = check<{ id: string }>(await supabase.rpc('record_coaching_outcome_evidence', { p_enrollment: enrollment.id, p_outcome: reviewOutcome.id, p_version: reviewOutcome.version, p_revision: latest.id, p_source_type: currentTask.module_id ? 'module_submission' : 'task_submission', p_module: currentTask.module_id, p_module_version: assignment?.assignment.content_version ?? null, p_session: null, p_summary: latest.text_response ?? currentTask.title }));
        check(await supabase.rpc('record_coaching_outcome_assessment', { p_enrollment: enrollment.id, p_outcome: reviewOutcome.id, p_version: reviewOutcome.version, p_status: assessment, p_rationale: reason || feedback, p_feedback: feedback, p_evidence_ids: [evidence.id] }));
        check(await supabase.rpc('record_coaching_work', { p_enrollment: enrollment.id, p_type: 'review', p_minutes: Number(minutes), p_day: new Date().toISOString().slice(0, 10), p_note: feedback }));
      })}>Record LO assessment</button></>}</div>}
    </section>}
    {profile.role === 'teacher' && assignment && pendingModuleAttempt && <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-7"><h2 className="text-xl font-bold text-master">Module Verify review</h2><p className="mt-1 text-sm">{assignment.version.manifest.title} · attempt {pendingModuleAttempt.id.slice(0, 8)}</p>
      {assignment.version.manifest.verifyPolicy.kind === 'rubric_sum' ? <div className="mt-3 grid gap-2 sm:grid-cols-4">{assignment.version.manifest.verifyPolicy.criteria.map((criterion, index) => <label key={criterion} className="text-sm">{criterion}<input className={input} type="number" min="0" max="2" value={rubricScores[index]} onChange={event => setRubricScores(old => old.map((value, i) => i === index ? Number(event.target.value) : value))} /></label>)}</div> : <div className="mt-3 space-y-2">{assignment.version.manifest.verifyPolicy.itemIds.map(id => <label key={id} className="flex gap-2 text-sm"><input type="checkbox" checked={passedItems.includes(id)} onChange={event => setPassedItems(old => event.target.checked ? [...old, id] : old.filter(value => value !== id))} />{id} passed</label>)}</div>}
      <button className="mt-3 rounded border px-3 py-2" onClick={() => void run(async () => {
        const policy = assignment.version.manifest.verifyPolicy;
        const review = policy.kind === 'rubric_sum' ? { scores: rubricScores } : { reviewedItems: policy.itemIds, passedItems, repeatedItems: [] };
        check(await supabase.rpc('review_generic_coaching_verify', { p_attempt: pendingModuleAttempt.id, p_review: review }));
        await chooseTask(assignment.assignment.task_id);
      })}>Record module Verify</button><p className="mt-2 text-xs text-slate-500">Module completion is separate from LO assessment.</p>
    </section>}
    {profile.role === 'student' && <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 sm:p-7"><h2 className="font-semibold">Your next action</h2><p className="text-sm text-slate-600">{enrollment?.goal_label}</p><div className="mt-3 space-y-2">{tasks.map(task => <button key={task.id} className={`block w-full rounded-xl border-2 p-4 text-left text-sm ${taskId===task.id?'border-emblue bg-sky-50':'border-slate-200 bg-white'}`} onClick={() => void chooseTask(task.id)}>{task.title} · {submissions.find(item => item.task_id === task.id)?.status ?? 'To do'}</button>)}</div>
      {currentTask && <div className="mt-4"><h3 className="font-medium">{currentTask.title}</h3><p className="text-sm text-slate-600">Why: {currentTask.instructions}</p>{assignment && <><p className="mt-2 text-sm">{assignment.version.manifest.title} · version {assignment.assignment.content_version}</p><button className="mt-2 rounded border px-3 py-2" onClick={() => void run(async () => { const next = await startGenericAttempt(currentTask.id); setAttempt(next); const inherited = check<{ prompt_id: string }[]>(await supabase.from('coaching_generic_inherited_recordings').select('prompt_id').eq('attempt_id', next.id)); setInheritedPrompts(inherited.map(row => row.prompt_id)); })}>Start or resume module</button>{attempt && assignment.version.manifest.stages.map(stage => <div key={stage.id} className="mt-4 rounded border p-4"><h4 className="font-semibold">{stage.title}</h4>{stage.activities.map((activity: PublicActivity) => <div key={activity.id} className="mt-3">{activity.type === 'media' ? <div><p className="text-sm">{activity.title}</p><button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => void run(async () => { const ref = String(activity.payload.assetRef); const media = await resolveAssignedModuleMedia(ref, currentTask.id, assignment.assignment.module_key, assignment.assignment.content_version); setResolvedMedia(old => ({ ...old, [ref]: media.url })); })}>Load assigned media</button>{resolvedMedia[String(activity.payload.assetRef)] && <iframe className="mt-2 aspect-video w-full" title={activity.title} src={resolvedMedia[String(activity.payload.assetRef)]} />}</div> : <GenericActivityPreview activity={activity} responses={responses} onResponse={(id, value) => setResponses(old => ({ ...old, [id]: value }))} recordings={recordings} onRecording={(id, objectUrl) => { setRecordings(old => ({ ...old, [id]: objectUrl })); }} />}{activity.type === 'recording' && (activity.payload.prompts as { id: string }[]).map(prompt => <div key={prompt.id} className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-sm">{inheritedPrompts.includes(prompt.id) ? 'Accepted from prior review' : `Attach synthetic WebM for ${prompt.id}`}<input disabled={inheritedPrompts.includes(prompt.id)} className={input} type="file" accept="audio/webm" onChange={event => { const file = event.target.files?.[0]; if (file) setRecordingFiles(old => ({ ...old, [prompt.id]: file })); }} /></label><label className="text-sm">Duration in seconds<input disabled={inheritedPrompts.includes(prompt.id)} className={input} type="number" min="1" max="600" value={recordingDurations[prompt.id] ?? ''} onChange={event => setRecordingDurations(old => ({ ...old, [prompt.id]: event.target.value }))} /></label></div>)}<button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => void run(async () => { if (activity.type === 'recording') { for (const prompt of activity.payload.prompts as { id: string }[]) { if (inheritedPrompts.includes(prompt.id)) continue; const file = recordingFiles[prompt.id]; const objectUrl = recordings[prompt.id]; if (!file && !objectUrl) throw new Error(`Attach or record ${prompt.id} first.`); const seconds = Number(recordingDurations[prompt.id]); if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) throw new Error(`Enter the duration for ${prompt.id}.`); const blob = file ? new Blob([file], { type: 'audio/webm' }) : new Blob([await (await fetch(objectUrl)).blob()], { type: 'audio/webm' }); const path = `${profile.id}/${currentTask.id}/${attempt.id}/${crypto.randomUUID()}.webm`; check(await supabase.storage.from('coaching-submissions').upload(path, blob, { contentType: 'audio/webm' })); await saveGenericRecording(attempt.id, prompt.id, path, seconds); } } else await saveGenericResponse(attempt.id, activity.id, responses); })}>Save {activity.type}</button></div>)}<button className="mt-3 rounded border px-3 py-2" onClick={() => void run(async () => { setAttempt(await completeGenericStage(attempt.id, stage.id)); })}>Complete stage</button></div>)}</>}
        <label className="mt-4 block text-sm">Your answer or revision<textarea className={input} value={answer} onChange={event => setAnswer(event.target.value)} /></label><button disabled={busy} className="mt-2 rounded bg-master px-4 py-2 text-white" onClick={() => void run(async () => { if (!answer.trim()) throw new Error('Enter your response.'); if (attempt) await submitGenericVerifyAtomic(attempt.id, answer, verifyRequestKeys.current[attempt.id] ??= crypto.randomUUID()); else if (currentSubmission) await updateOwnSubmission({ submission_id: currentSubmission.id, text_response: answer, storage_path: null, duration_seconds: null, submit: true }); else await createSubmission({ task_id: currentTask.id, student_id: profile.id, text_response: answer, storage_path: null, duration_seconds: null, submit: true }); })}>Submit evidence</button>{currentSubmission?.feedback_text && <p className="mt-3 rounded bg-sky-50 p-3 text-sm">Coach feedback: {currentSubmission.feedback_text}</p>}</div>}
    </section>}
    {message && <p role="status" className="rounded bg-sky-50 p-3 text-sm">{message}</p>}
  </main>;
}
