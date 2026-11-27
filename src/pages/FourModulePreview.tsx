import { useEffect, useRef, useState } from 'react';
import { GenericActivityPreview } from '../modules/GenericActivityPreview';
import { evaluateVerify } from '../modules/genericEngine';
import { fourModulePreviews } from '../modules/fourModulePreviews';

export function FourModulePreview() {
  const [moduleIndex, setModuleIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string,string>>({});
  const [recordings, setRecordings] = useState<Record<string,string>>({});
  const recordingUrls = useRef(new Set<string>());
  const [scores, setScores] = useState<number[]>([0,0,0,0]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const [repeated, setRepeated] = useState<string[]>([]);
  const module = fourModulePreviews[moduleIndex];
  const stage = module.stages[stageIndex];
  const policy = module.verifyPolicy;
  const assessmentReady = policy.kind === 'rubric_sum'
    ? evaluateVerify(policy, { scores, freshRecording: Boolean(recordings['verify-audio-1']) })
    : evaluateVerify(policy, { reviewedItems: reviewed, passedItems: passed, repeatedItems: repeated });
  useEffect(() => () => { recordingUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const changeModule = (index: number) => { recordingUrls.current.forEach(url => URL.revokeObjectURL(url)); recordingUrls.current.clear(); setModuleIndex(index); setStageIndex(0); setResponses({}); setRecordings({}); setScores([0,0,0,0]); setReviewed([]); setPassed([]); setRepeated([]); };
  const setRecording = (id:string,url:string) => { if (recordings[id]) { URL.revokeObjectURL(recordings[id]); recordingUrls.current.delete(recordings[id]); } recordingUrls.current.add(url); setRecordings(old => ({ ...old, [id]:url })); };
  const toggle = (values:string[],set:(items:string[])=>void,id:string) => set(values.includes(id) ? values.filter(x => x !== id) : [...values,id]);
  return <main className="page-container space-y-6">
    <header className="rounded-2xl bg-master p-6 text-white"><p className="text-xs font-bold uppercase tracking-wider text-sky-200">Generic engine · structural preview</p><h1 className="mt-2 text-2xl font-bold">Four Speaking module shapes</h1><p className="mt-2 text-sm text-slate-200">Source teaching text and assets are intentionally absent pending private import, media mapping and academic parity approval. No student progress is written.</p></header>
    <nav aria-label="Select module" className="flex flex-wrap gap-2">{fourModulePreviews.map((item,index) => <button type="button" key={item.moduleId} aria-current={index === moduleIndex ? 'true' : undefined} onClick={() => changeModule(index)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${index === moduleIndex ? 'bg-master text-white' : 'bg-white text-master ring-1 ring-slate-200'}`}>{item.title}</button>)}</nav>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="text-xl font-semibold text-master">{module.title}</h2><p className="text-sm text-slate-600">{module.estimatedMinutes} min · {module.level} · {module.outcomeIds.join(', ')}</p><p className="mt-2 text-sm">Outcome scope: {module.outcomeStatement}</p>
      <nav aria-label="Module stages" className="mt-5 flex flex-wrap gap-2">{module.stages.map((item,index) => <button type="button" key={item.id} aria-current={index === stageIndex ? 'step' : undefined} onClick={() => setStageIndex(index)} className={`rounded-lg border px-3 py-2 text-sm ${index === stageIndex ? 'border-emblue bg-sky-50' : 'border-slate-200'}`}>{item.title}</button>)}</nav>
      <h3 className="mt-6 text-lg font-semibold">{stage.title}</h3><div className="mt-3 space-y-5">{stage.activities.map(activity => <GenericActivityPreview key={activity.id} activity={activity} responses={responses} onResponse={(id,value) => setResponses(old => ({ ...old,[id]:value }))} recordings={recordings} onRecording={setRecording} />)}</div>
    </section>
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200"><h2 className="text-lg font-semibold text-master">Verify rule simulation</h2><p className="mt-1 text-sm text-slate-600">This local rule check does not record a coach decision or award mastery.</p>
      {policy.kind === 'rubric_sum' ? <div className="mt-3 grid gap-3 sm:grid-cols-4">{policy.criteria.map((criterion,index) => <label key={criterion} className="text-sm">{criterion}<select className="mt-1 block w-full rounded border p-2" value={scores[index]} onChange={event => setScores(old => old.map((value,i) => i === index ? Number(event.target.value) : value))}>{[0,1,2].map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}</div> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{policy.itemIds.map(id => <div key={id} className="rounded border p-3 text-sm"><strong>{id}</strong>{(['reviewed','passed','repeated'] as const).map(kind => { const values = kind === 'reviewed' ? reviewed : kind === 'passed' ? passed : repeated; const setter = kind === 'reviewed' ? setReviewed : kind === 'passed' ? setPassed : setRepeated; return <label key={kind} className="ml-3 inline-flex gap-1"><input type="checkbox" checked={values.includes(id)} onChange={() => toggle(values,setter,id)} />{kind}</label>; })}</div>)}</div>}
      <p className="mt-4 font-semibold">{assessmentReady ? 'Rule conditions met; coach decision still required.' : 'Rule conditions not met.'}</p>
    </section>
  </main>;
}
