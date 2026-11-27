import { useState } from 'react';
import { pilotOutcomes, syntheticLearners } from '../coachingCore/syntheticPilot';
import type { EvidenceSource, PilotLearner } from '../coachingCore/pilotContract';

const sourceLabel: Record<EvidenceSource, string> = {
  module_attempt: 'Module attempt', task_submission: 'Direct task submission', live_session_note: 'Live coaching note',
};

export function CoachOutcomePrototype() {
  const [selectedId, setSelectedId] = useState(syntheticLearners[0].id);
  const learner = syntheticLearners.find((item) => item.id === selectedId) as PilotLearner;
  const totalMinutes = syntheticLearners.reduce((sum, item) => sum + item.coachMinutesThisWeek, 0);
  const assessedCount = syntheticLearners.reduce((sum, item) => sum + item.assessments.length, 0);

  return <main className="page-container space-y-6">
    <div className="rounded-2xl bg-master p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-wider text-sky-200">Isolated frontend prototype · synthetic data</p>
      <h1 className="mt-2 text-2xl font-bold">Coach workspace: outcome decisions</h1>
      <p className="mt-2 text-sm text-slate-200">Two learners share one target. The coach assigns different work from observed needs. This view makes no network requests or writes.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Pilot measures">
      <Metric label="Pilot learners" value={String(syntheticLearners.length)} />
      <Metric label="Coach minutes this week" value={String(totalMinutes)} />
      <Metric label="Documented LO assessments" value={String(assessedCount)} />
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose learner">
      {syntheticLearners.map((item) => <button key={item.id} type="button" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${selectedId === item.id ? 'bg-master text-white' : 'bg-white text-master ring-1 ring-slate-200'}`}>{item.name}</button>)}
    </div>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-xl font-semibold text-master">{learner.name}</h2>
      <p className="text-sm text-slate-600">Target: {learner.target} · Coach time this week: {learner.coachMinutesThisWeek} minutes</p>
      <h3 className="mt-5 font-semibold">Priority learning outcomes</h3>
      <div className="mt-2 grid gap-3 md:grid-cols-2">{learner.priorityOutcomeIds.map((id) => {
        const outcome = pilotOutcomes.find((item) => item.id === id);
        const assessment = learner.assessments.find((item) => item.outcomeId === id);
        return <article key={id} className="rounded-lg border border-slate-200 p-4"><p className="font-medium text-master">{outcome?.statement}</p><p className="mt-1 text-xs text-slate-500">Evidence criterion: {outcome?.successCriteria}</p><p className="mt-3 text-sm"><strong>Coach assessment:</strong> {assessment?.status.replaceAll('_', ' ') ?? 'Not assessed'}</p>{assessment && <p className="mt-1 text-sm text-slate-600">{assessment.rationale}</p>}</article>;
      })}</div>
    </section>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h3 className="text-lg font-semibold text-master">Personalized assignments</h3><div className="mt-3 space-y-3">{learner.assignments.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">{item.title}</h4><span className="text-xs text-slate-500">Due {item.due}</span></div><p className="mt-1 text-sm">Why: {item.reason}</p><p className="mt-1 text-xs text-slate-500">{item.moduleId ? 'Module resource' : 'No module'} · Expected evidence: {sourceLabel[item.evidenceExpected]}</p></article>)}</div></section>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h3 className="text-lg font-semibold text-master">Evidence and coach decisions</h3><div className="mt-3 space-y-3">{learner.evidence.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-emblue">{sourceLabel[item.source]} · {item.capturedAt}</p><p className="mt-1 text-sm">{item.summary}</p><p className="mt-1 text-xs text-slate-500">Evidence ref: {item.sourceRef}</p></article>)}</div></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-master">{value}</p></div>;
}
