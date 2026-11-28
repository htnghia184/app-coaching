import { useState } from 'react';
import { pilotOutcomes, syntheticLearners } from '../coachingCore/syntheticPilot';
import { prescribeTask, recordAssessment, setPriorities, submitEvidence } from '../coachingCore/pilotActions';
import type { EvidenceSource, OutcomeStatus, PilotLearner } from '../coachingCore/pilotContract';
import { fourModulePreviews } from '../modules/fourModulePreviews';

const sourceLabel: Record<EvidenceSource, string> = {
  module_submission: 'Module submission', task_submission: 'Direct task submission', live_session_note: 'Live coaching note',
};
const statuses: OutcomeStatus[] = ['not_assessed', 'emerging', 'developing', 'demonstrated', 'needs_recheck'];

export function CoachOutcomePrototype() {
  const [learners, setLearners] = useState<PilotLearner[]>(() => structuredClone(syntheticLearners));
  const [selectedId, setSelectedId] = useState(syntheticLearners[0].id);
  const [outcomeId, setOutcomeId] = useState(pilotOutcomes[0].id);
  const [targetIds, setTargetIds] = useState<string[]>([pilotOutcomes[0].id]);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [status, setStatus] = useState<OutcomeStatus>('developing');
  const [rationale, setRationale] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reviewMinutes, setReviewMinutes] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskReason, setTaskReason] = useState('');
  const [taskSource, setTaskSource] = useState<EvidenceSource>('task_submission');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [planningMinutes, setPlanningMinutes] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'coach' | 'student'>('coach');
  const [studentSummary, setStudentSummary] = useState('');
  const learner = learners.find(item => item.id === selectedId) as PilotLearner;
  const matchingEvidence = learner.evidence.filter(item => item.outcomeId === outcomeId && item.outcomeVersion === 1);
  const nextAction = learner.assignments.at(-1);
  const availableModules = fourModulePreviews.filter(item => targetIds.length === 0 || item.outcomes.some(link => targetIds.includes(link.id) && link.version === 1));
  const latestAssessment = (id: string) => learner.assessments.filter(item => item.outcomeId === id).at(-1);
  const update = (change: (old: PilotLearner) => PilotLearner) => {
    try {
      const changed = change(learner);
      setLearners(old => old.map(item => item.id === selectedId ? changed : item));
      setMessage('Saved in this browser tab only.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update prototype.'); }
  };
  const changeLearner = (id: string) => { setSelectedId(id); setEvidenceIds([]); setMessage(''); };
  const changeOutcome = (id: string) => { setOutcomeId(id); setEvidenceIds([]); setMessage(''); };

  return <main className="page-container space-y-6">
    <header className="rounded-2xl bg-master p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-wider text-sky-200">Synthetic prototype · no real learner data</p>
      <h1 className="mt-2 text-2xl font-bold">Integrated Coaching Pilot</h1>
      <p className="mt-2 text-sm text-slate-200">Coach and learner preview. Changes stay in this tab.</p>
    </header>
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Pilot measures">
      <Metric label="Pilot learners" value={String(learners.length)} />
      <Metric label="Coach minutes this week" value={String(learners.reduce((sum, item) => sum + item.coachMinutesThisWeek, 0))} />
      <Metric label="Assessments recorded" value={String(learners.reduce((sum, item) => sum + item.assessments.length, 0))} />
    </div>
    <nav className="flex flex-wrap gap-2" aria-label="Choose learner">{learners.map(item => <button key={item.id} type="button" aria-current={selectedId === item.id ? 'true' : undefined} onClick={() => changeLearner(item.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${selectedId === item.id ? 'bg-master text-white' : 'bg-white text-master ring-1 ring-slate-200'}`}>{item.name}</button>)}</nav>
    <nav className="flex gap-2" aria-label="Choose preview role"><button type="button" className="rounded-lg border px-4 py-2" aria-current={view === 'coach' ? 'page' : undefined} onClick={() => setView('coach')}>Coach preview</button><button type="button" className="rounded-lg border px-4 py-2" aria-current={view === 'student' ? 'page' : undefined} onClick={() => setView('student')}>Student preview</button></nav>
    {view === 'student' ? <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="text-xl font-semibold text-master">{learner.name} · {learner.target}</h2><p className="mt-3"><strong>Next action:</strong> {nextAction?.title ?? 'Await coach assignment'}</p>{nextAction && <><p className="text-sm text-slate-600">Why: {nextAction.reason} · Due {nextAction.due}</p><p className="mt-3 text-sm">Evidence path: {sourceLabel[nextAction.evidenceExpected]}{nextAction.moduleId && ` · ${nextAction.moduleId} v${nextAction.moduleVersion}`}</p><label className="mt-4 block text-sm">Describe your evidence or revision<textarea className="mt-1 block w-full rounded border p-2" value={studentSummary} onChange={event => setStudentSummary(event.target.value)} /></label><button type="button" className="mt-3 rounded bg-master px-4 py-2 text-white" onClick={() => update(old => submitEvidence(old, { assignmentId: nextAction.id, source: nextAction.evidenceExpected, summary: studentSummary }))}>Submit synthetic evidence</button></>}<h3 className="mt-6 font-semibold">Coach feedback</h3>{learner.assessments.map(item => <p key={item.id} className="mt-2 rounded border p-3 text-sm">{item.status.replaceAll('_', ' ')}: {item.feedback}</p>)}<h3 className="mt-6 font-semibold">Submitted evidence and revisions</h3>{learner.evidence.map(item => <p key={item.id} className="mt-2 rounded border p-3 text-sm">{sourceLabel[item.source]} · {item.summary} · {item.sourceRef}</p>)}</section> : <>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-xl font-semibold text-master">{learner.name} · {learner.target}</h2>
      <p className="mt-2 text-sm"><strong>Learner's next action:</strong> {nextAction?.title ?? 'Coach to prescribe a task'}</p>
      {nextAction && <p className="text-sm text-slate-600">Why: {nextAction.reason} · Due {nextAction.due}</p>}
      <fieldset className="mt-5"><legend className="font-semibold">Priority learning outcomes</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{pilotOutcomes.map(item => <label key={item.id} className="flex gap-2 rounded-lg border border-slate-200 p-3 text-sm"><input type="checkbox" checked={learner.priorityOutcomes.some(ref => ref.id === item.id && ref.version === item.version)} onChange={() => update(old => setPriorities(old, old.priorityOutcomes.some(ref => ref.id === item.id && ref.version === item.version) ? old.priorityOutcomes.filter(ref => ref.id !== item.id || ref.version !== item.version) : [...old.priorityOutcomes, { id: item.id, version: item.version }]))} /><span>{item.statement}<small className="mt-1 block text-slate-500">{latestAssessment(item.id)?.status.replaceAll('_', ' ') ?? 'Not assessed'}</small></span></label>)}</div></fieldset>
    </section>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h3 className="text-lg font-semibold text-master">Evidence and review</h3>
      <label className="mt-3 block text-sm">Outcome<select className="mt-1 block w-full rounded-lg border p-2" value={outcomeId} onChange={event => changeOutcome(event.target.value)}>{pilotOutcomes.map(item => <option key={item.id} value={item.id}>{item.statement}</option>)}</select></label>
      <p className="mt-2 text-sm text-slate-600">Criterion: {pilotOutcomes.find(item => item.id === outcomeId)?.successCriteria}</p>
      <fieldset className="mt-4"><legend className="font-medium">Evidence for this assessment</legend>{matchingEvidence.length === 0 && <p className="text-sm text-slate-500">No evidence for this outcome yet. Choose another outcome.</p>}{matchingEvidence.map(item => <label key={item.id} className="mt-2 flex gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={evidenceIds.includes(item.id)} onChange={() => setEvidenceIds(old => old.includes(item.id) ? old.filter(id => id !== item.id) : [...old, item.id])} /><span><strong>{sourceLabel[item.source]}</strong> · {item.summary}<small className="block text-slate-500">{item.capturedAt} · {item.sourceRef}</small></span></label>)}</fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Assessment status<select className="mt-1 block w-full rounded-lg border p-2" value={status} onChange={event => setStatus(event.target.value as OutcomeStatus)}>{statuses.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label><label className="text-sm">Coach rationale<input className="mt-1 block w-full rounded-lg border p-2" value={rationale} onChange={event => setRationale(event.target.value)} /></label></div>
      <label className="mt-3 block text-sm">Feedback to learner<textarea className="mt-1 block w-full rounded-lg border p-2" value={feedback} onChange={event => setFeedback(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Review minutes<input type="number" min="1" max="480" className="mt-1 block w-32 rounded border p-2" value={reviewMinutes} onChange={event => setReviewMinutes(event.target.value)} /></label>
      <button type="button" className="mt-3 rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white" onClick={() => update(old => recordAssessment(old, { outcomeId, outcomeVersion: 1, status, evidenceIds, rationale, feedback, minutes: Number(reviewMinutes) }))}>Record assessment</button>
      <h4 className="mt-5 font-semibold">Assessment history</h4><ol className="mt-2 space-y-2">{learner.assessments.filter(item => item.outcomeId === outcomeId).map(item => <li key={item.id} className="rounded-lg border p-3 text-sm"><strong>{item.status.replaceAll('_', ' ')}</strong> · {item.assessedAt}<p>{item.rationale}</p>{item.feedback && <p className="text-slate-600">Feedback: {item.feedback}</p>}<small>Evidence: {item.evidenceIds.join(', ')}</small></li>)}</ol>
    </section>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="text-lg font-semibold text-master">Prescribe next task</h3>
      <fieldset className="mt-3"><legend className="text-sm font-medium">Target LOs (optional)</legend>{learner.priorityOutcomes.map(ref => <label key={`${ref.id}:${ref.version}`} className="mr-4 inline-flex gap-2 text-sm"><input type="checkbox" checked={targetIds.includes(ref.id)} onChange={() => setTargetIds(old => old.includes(ref.id) ? old.filter(id => id !== ref.id) : [...old, ref.id])} />{pilotOutcomes.find(item => item.id === ref.id)?.statement ?? ref.id} · v{ref.version}</label>)}</fieldset>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Title<input className="mt-1 block w-full rounded-lg border p-2" value={taskTitle} onChange={event => setTaskTitle(event.target.value)} /></label>
        <label className="text-sm">Evidence path<select className="mt-1 block w-full rounded-lg border p-2" value={taskSource} onChange={event => setTaskSource(event.target.value as EvidenceSource)}>{Object.entries(sourceLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {taskSource === 'module_submission' && <label className="mt-3 block text-sm">Optional module resource<select className="mt-1 block w-full rounded border p-2" value={selectedModuleId} onChange={event => setSelectedModuleId(event.target.value)}><option value="">Choose a module</option>{availableModules.map(item => <option key={item.moduleId} value={item.moduleId}>{item.title} · v{item.contentVersion}</option>)}</select></label>}
      <label className="mt-3 block text-sm">Reason for learner<input className="mt-1 block w-full rounded-lg border p-2" value={taskReason} onChange={event => setTaskReason(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Planning minutes<input type="number" min="1" max="480" className="mt-1 block w-32 rounded border p-2" value={planningMinutes} onChange={event => setPlanningMinutes(event.target.value)} /></label>
      <button type="button" className="mt-3 rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white" onClick={() => {
        const selectedModule = availableModules.find(item => item.moduleId === selectedModuleId);
        update(old => prescribeTask(old, { outcomes: old.priorityOutcomes.filter(ref => targetIds.includes(ref.id)), title: taskTitle, reason: taskReason,
          moduleId: taskSource === 'module_submission' ? selectedModule?.moduleId ?? null : null,
          moduleVersion: taskSource === 'module_submission' ? selectedModule?.contentVersion ?? null : null,
          evidenceExpected: taskSource, due: '2026-12-05' }, Number(planningMinutes)));
      }}>Assign synthetic task</button>
      <ul className="mt-4 space-y-2">{learner.assignments.map(item => <li key={item.id} className="rounded-lg border p-3 text-sm"><strong>{item.title}</strong> · {sourceLabel[item.evidenceExpected]}{item.moduleId && <span> · {item.moduleId} v{item.moduleVersion}</span>}<p className="text-slate-600">{item.reason}</p></li>)}</ul>
    </section>
    </>}
    {message && <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-master">{message}</p>}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-master">{value}</p></div>; }
