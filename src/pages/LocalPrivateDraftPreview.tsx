import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabaseClient';
import { parsePublicModule, type PublicModule, type PublicActivity } from '../modules/genericEngine';
import { GenericActivityPreview } from '../modules/GenericActivityPreview';
import { resolveDraftModuleMedia } from '../modules/moduleMedia';

type Draft = { module_key: string; content_version: number; manifest: PublicModule };

export function LocalPrivateDraftPreview() {
  const { profile, loading, session, signOut } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);
  const local = import.meta.env.DEV && /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(import.meta.env.VITE_SUPABASE_URL ?? '');
  useEffect(() => {
    if (!local || profile?.role !== 'admin') return;
    let active = true;
    setPending(true);
    void supabase.from('coaching_generic_module_drafts').select('module_key,content_version,manifest').then(({ data, error: loadError }) => {
      if (!active) return;
      try {
        if (loadError) throw new Error(loadError.message);
        const rows = (data ?? []).map(row => ({ ...row, manifest: parsePublicModule(row.manifest) })).sort((a,b) => a.module_key.localeCompare(b.module_key) || b.content_version-a.content_version);
        setDrafts(rows);
        setSelected(rows[0] ? draftKey(rows[0]) : '');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid draft'); }
      finally { setPending(false); }
    });
    return () => { active = false; };
  }, [local, profile?.role, profile?.id]);
  if (!local) return <main className="page-container"><p>Local admin preview only.</p></main>;
  if (loading || (session && !profile)) return <main className="page-container"><p>Loading local account…</p><Link to="/login">Return to login</Link></main>;
  if (profile?.role !== 'admin') return <main className="page-container space-y-3"><p>Local admin preview only.</p><p>Sign in as the local admin to review unpublished learning materials.</p><Link className="text-master underline" to="/login">Sign in</Link>{session && <button className="ml-4 underline" onClick={() => void signOut()}>Sign out</button>}</main>;
  const draft = drafts.find(item => draftKey(item) === selected);
  return <main className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emblue">E-Master · Academic review</p><h1 className="mt-1 text-2xl font-bold text-master">Academic content preview</h1></div>
        <div className="flex gap-4 text-sm"><Link className="text-master underline" to="/local-pilot">Pilot workspace</Link><button className="underline" onClick={() => void signOut()}>Sign out</button></div>
      </header>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Unpublished draft · Local admin only · Academic approval pending. Responses and recordings stay in this tab; no learner results are saved.</div>
      <label className="block text-sm font-semibold text-master">Module<select className="mt-2 block w-full rounded-xl border bg-white p-3 sm:max-w-xl" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Select draft</option>{drafts.map(item => <option key={draftKey(item)} value={draftKey(item)}>{item.manifest.title} · v{item.content_version}</option>)}</select></label>
      {pending && <p role="status">Loading drafts…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!pending && !error && !drafts.length && <p>No unpublished drafts found.</p>}
      {draft && <DraftPlayer key={draftKey(draft)} draft={draft}/>}
    </div>
  </main>;
}
function draftKey(draft: Draft) { return draft.module_key + ':' + draft.content_version; }

function DraftPlayer({ draft }: { draft: Draft }) {
  const { manifest } = draft;
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [responses, setResponses] = useState<Record<string, Record<string,string>>>({});
  const [recordings, setRecordings] = useState<Record<string,string>>({});
  const [resetKey, setResetKey] = useState(0);
  const [finished, setFinished] = useState(false);
  const stage = manifest.stages[step];
  const units = stage.activities.flatMap(splitActivity);
  const isPractice = stage.id === 'Practice';
  const visible = isPractice ? units.slice(unit,unit+1) : units;
  const navigate = (index: number) => { setStep(index); setUnit(0); setFinished(false); };
  const reset = () => { setStep(0); setUnit(0); setCompleted([]); setResponses({}); setRecordings({}); setFinished(false); setResetKey(x=>x+1); };
  const next = () => {
    if (isPractice && unit < units.length-1) { setUnit(x=>x+1); return; }
    setCompleted(old => [...new Set([...old, stage.id])]);
    if (step < manifest.stages.length-1) navigate(step+1); else setFinished(true);
  };
  return <>
    <section className="rounded-3xl bg-master p-6 text-white sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-200">{manifest.skill} · {manifest.level} · {manifest.estimatedMinutes} min</p>
      <h2 className="mt-3 text-3xl font-bold">{manifest.title}</h2>
      <p className="mt-3 text-sm text-sky-100">{manifest.outcomeStatement}</p>
      <div className="mt-5 flex justify-between text-xs"><span>Demo progress</span><span>{completed.length}/{manifest.stages.length} stages</span></div>
      <div className="mt-2 h-2 rounded-full bg-white/20"><div className="h-2 rounded-full bg-sky-300 transition-all" style={{width: (completed.length / manifest.stages.length * 100) + '%'}}/></div>
    </section>
    <nav aria-label="Learning stages" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{manifest.stages.map((s,i)=><button key={s.id} aria-current={i===step?'step':undefined} onClick={()=>navigate(i)} className={'rounded-xl border p-3 text-left '+(i===step?'border-emblue bg-sky-50':'border-slate-200 bg-white')}><span className="block text-xs font-bold text-emblue">{completed.includes(s.id)?'✓':i+1}</span><span className="font-semibold text-master">{s.title}</span></button>)}</nav>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_245px]">
      <section className="min-w-0 rounded-3xl border bg-white shadow-sm">
        <header className="border-b p-6"><p className="text-xs font-bold uppercase tracking-widest text-emblue">Stage {step+1} / {manifest.stages.length}</p><h2 className="mt-2 text-2xl font-bold text-master">{stage.title}</h2>{isPractice && <p className="mt-2 text-sm text-slate-500">Interaction {Math.min(unit+1,units.length)} / {units.length}</p>}</header>
        <div className="space-y-6 p-5 sm:p-8" key={resetKey}>
          {visible.map(({activity, key})=><div key={key} className="space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{activity.instructions}</p>
            {activity.type==='media' ? <DraftMedia activity={activity} draft={draft}/> : <GenericActivityPreview activity={activity} responses={responses[activity.id]??{}} onResponse={(id,value)=>setResponses(old=>({...old,[activity.id]:{...old[activity.id],[id]:value}}))} recordings={recordings} onRecording={(id,url)=>setRecordings(old=>({...old,[id]:url}))}/>}
          </div>)}
          {finished && <p role="status" className="rounded-xl bg-sky-50 p-4 text-master">Demo complete. No mastery result or coach assessment has been recorded.</p>}
          <div className="flex flex-wrap gap-3 border-t pt-5">
            <button disabled={step===0&&unit===0} className="rounded-xl border px-4 py-3 text-sm disabled:opacity-40" onClick={()=>isPractice&&unit>0?setUnit(x=>x-1):navigate(Math.max(0,step-1))}>← Back</button>
            {!finished&&<button className="rounded-xl bg-emblue px-5 py-3 text-sm font-bold text-white" onClick={next}>{isPractice&&unit<units.length-1?'Next question →':step===manifest.stages.length-1?'Finish demo':'Continue →'}</button>}
            <button className="ml-auto text-sm text-slate-500 underline" onClick={reset}>Reset demo</button>
          </div>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Learning goal</p><p className="mt-3 font-semibold text-master">{manifest.outcomeStatement}</p></div>
        <div className="rounded-2xl bg-sky-50 p-5 text-sm text-master"><p className="font-bold">Reviewer mode</p><p className="mt-2">Jump to any stage. This is a draft preview, not a scored learner attempt.</p></div>
        {(stage.id==='Reflect'||stage.id==='Verify')&&Object.entries(recordings).map(([id,url])=><div key={id} className="rounded-xl border bg-white p-3"><p className="text-xs">{id}</p><audio controls className="mt-2 w-full" src={url}/></div>)}
      </aside>
    </div>
  </>;
}
function splitActivity(activity: PublicActivity): {activity: PublicActivity; key:string}[] {
  const field = activity.type==='choice'?'items':activity.type==='matching'?'prompts':activity.type==='text_response'?'fields':null;
  if (!field) return [{activity,key:activity.id}];
  const items = activity.payload[field] as {id:string}[];
  return items.map(item=>({key:activity.id+':'+item.id,activity:{...activity,payload:{...activity.payload,[field]:[item]}}}));
}
function DraftMedia({activity,draft}:{activity:PublicActivity;draft:Draft}) {
  const [url,setUrl]=useState('');
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setError('');setUrl('');
    void resolveDraftModuleMedia(String(activity.payload.assetRef),draft.module_key,draft.content_version).then(value=>{if(active)setUrl(value.url);}).catch(()=>{if(active)setError('Media unavailable or not yet configured.');});
    return ()=>{active=false;};
  },[activity.payload.assetRef,draft.module_key,draft.content_version,retry]);
  return <div className="rounded-2xl border p-4"><p className="font-semibold text-master">{activity.title}</p>{url?<iframe className="mt-3 aspect-video w-full rounded-xl" title={activity.title} src={url} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>:<p className="mt-2 text-sm text-slate-500">{error||'Loading private media…'}</p>}<button className="mt-2 text-sm underline" onClick={()=>setRetry(x=>x+1)}>Load private media</button></div>;
}
