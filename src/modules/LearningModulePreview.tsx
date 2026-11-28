import { useState } from 'react';
import type { LearningActivity, LearningModule } from './learningSchema';

export function LearningActivityRenderer({ activity, responses, onResponse }: {
  activity: LearningActivity;
  responses: Record<string, string>;
  onResponse: (id: string, value: string) => void;
}) {
  if (activity.type === 'video') return <section className="overflow-hidden rounded-3xl bg-[#192f57] text-white">
    <div className="flex aspect-video flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl" aria-hidden="true">▶</span><h3 className="text-xl font-bold">{activity.title}</h3>
      <p className="text-sm text-slate-300">{activity.verified ? 'Video lesson' : 'Video access not verified'}</p>
    </div>
    <div className="p-5"><a href={activity.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-sky-200 underline">Open source video ↗</a></div>
  </section>;
  if (activity.type === 'lesson') return <section className="space-y-3">
    <h3 className="text-lg font-bold text-[#2A4272]">{activity.title}</h3>
    {activity.sections.map((section, index) => <details key={index} open={index === 0} className="rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold text-[#2A4272]">{section.title}</summary>
      <p className="mt-3 text-sm leading-relaxed">{section.body}</p>
      {section.example && <p className="mt-3 rounded-xl bg-sky-50 p-4 text-sm italic">{section.example}</p>}
    </details>)}
  </section>;
  if (activity.type === 'multiple_choice') return <section className="space-y-5">
    <h3 className="text-lg font-bold text-[#2A4272]">{activity.title}</h3>
    {activity.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 p-5">
      <legend className="px-2 text-sm font-semibold">Question {index + 1}</legend>
      <p className="mb-4 font-medium">{question.prompt}</p>
      <div className="grid gap-2">{question.options.map(option => <button key={option.id} type="button"
        aria-pressed={responses[question.id] === option.id} onClick={() => onResponse(question.id, option.id)}
        className={`rounded-xl border-2 p-4 text-left text-sm ${responses[question.id] === option.id ? 'border-[#3A8FDB] bg-sky-50' : 'border-slate-200'}`}>
        <strong className="mr-3">{option.id}</strong>{option.text}
      </button>)}</div>
    </fieldset>)}
  </section>;
  if (activity.type === 'matching') return <section className="space-y-4">
    <h3 className="text-lg font-bold text-[#2A4272]">{activity.title}</h3>
    {activity.prompts.map(prompt => <label key={prompt.id} className="block rounded-2xl border border-slate-200 p-4 text-sm">
      <span className="block font-semibold">{prompt.text}</span>
      <select value={responses[prompt.id] ?? ''} onChange={event => onResponse(prompt.id, event.target.value)}
        className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3">
        <option value="">Choose a match</option>
        {activity.options.map(option => <option key={option.id} value={option.id}>{option.id} — {option.text}</option>)}
      </select>
    </label>)}
  </section>;
  if (activity.type === 'reflection') return <section className="space-y-3">
    <h3 className="text-lg font-bold text-[#2A4272]">{activity.title}</h3>
    {activity.items.map((item, index) => <label key={index} className="flex items-start gap-3 rounded-xl border p-4 text-sm">
      <input type="checkbox" checked={responses[`${activity.id}-${index}`] === 'yes'}
        onChange={event => onResponse(`${activity.id}-${index}`, event.target.checked ? 'yes' : '')}/>{item}
    </label>)}
  </section>;
  return <section className="space-y-3"><h3 className="text-lg font-bold text-[#2A4272]">{activity.title}</h3>
    {activity.prompts.map(prompt => <div key={prompt.id} className="rounded-2xl border p-4">
      <p className="font-semibold">{prompt.text}</p>
      <p className="mt-2 text-xs text-slate-500">Recording requires a microphone-enabled player. This generic preview does not upload audio.</p>
    </div>)}
  </section>;
}

/** Standalone, backend-free generic player. Stage names and activity combinations are data-driven. */
export function LearningModulePreview({ module }: { module: LearningModule }) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const stage = module.stages[step];
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header className="rounded-3xl bg-[#192f57] p-8 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-200">{module.skill} · {module.level} · {module.minutes} min</p>
      <h1 className="mt-3 text-3xl font-bold">{module.title}</h1><p className="mt-3 text-sm text-slate-200">{module.outcome}</p>
    </header>
    <nav aria-label="Module stages" className="flex flex-wrap gap-2">{module.stages.map((item, index) =>
      <button key={item.id} type="button" aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}
        className={`rounded-xl border px-4 py-3 text-sm font-semibold ${step === index ? 'border-[#3A8FDB] bg-sky-50 text-[#2A4272]' : 'border-slate-200 bg-white'}`}>{index + 1}. {item.title}</button>)}</nav>
    <main className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-9">
      <h2 className="text-2xl font-bold text-[#2A4272]">{stage.title}</h2>
      {stage.activities.map(activity => <LearningActivityRenderer key={activity.id} activity={activity}
        responses={responses} onResponse={(id, value) => setResponses(old => ({ ...old, [id]: value }))}/>)}
      <div className="flex gap-3 border-t pt-5">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-xl border px-5 py-3 disabled:opacity-30">Back</button>
        <button type="button" disabled={step === module.stages.length - 1} onClick={() => setStep(step + 1)}
          className="rounded-xl bg-[#2A4272] px-5 py-3 font-semibold text-white disabled:opacity-30">Continue →</button>
      </div>
    </main>
    <p className="text-xs text-slate-500">Admin preview · Browser memory only · No server writes or assessment results</p>
  </div>;
}
