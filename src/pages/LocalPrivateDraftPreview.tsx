import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabaseClient';
import { parsePublicModule, type PublicModule } from '../modules/genericEngine';
import { GenericActivityPreview } from '../modules/GenericActivityPreview';
import { resolveDraftModuleMedia } from '../modules/moduleMedia';

type Draft = { module_key: string; content_version: number; manifest: PublicModule };

export function LocalPrivateDraftPreview() {
  const { profile } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState('');
  const [responses, setResponses] = useState<Record<string,string>>({});
  const [recordings, setRecordings] = useState<Record<string,string>>({});
  const [media, setMedia] = useState<Record<string,string>>({});
  const [error, setError] = useState('');
  const local = import.meta.env.DEV && /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(import.meta.env.VITE_SUPABASE_URL ?? '');
  useEffect(() => {
    if (!local || profile?.role !== 'admin') return;
    void supabase.from('coaching_generic_module_drafts').select('module_key,content_version,manifest').then(({ data, error: loadError }) => {
      if (loadError) { setError(loadError.message); return; }
      try { setDrafts((data ?? []).map(row => ({ ...row, manifest: parsePublicModule(row.manifest) }))); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid draft'); }
    });
  }, [local, profile?.role]);
  if (!local || profile?.role !== 'admin') return <p>Local admin preview only.</p>;
  const draft = drafts.find(item => item.module_key === selected);
  return <main className="mx-auto max-w-4xl p-6"><p className="text-xs font-bold uppercase tracking-wide">Supabase Local · unpublished private draft</p><h1 className="mt-2 text-2xl font-semibold">Academic content preview</h1><p className="mt-2 text-sm">Converted draft; source parity and academic approval remain pending. Nothing here is assigned or published.</p>
    <label className="mt-5 block">Module<select className="ml-2 rounded border p-2" value={selected} onChange={event => { setSelected(event.target.value); setMedia({}); }}><option value="">Select draft</option>{drafts.map(item => <option key={item.module_key} value={item.module_key}>{item.manifest.title}</option>)}</select></label>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {draft && <><h2 className="mt-6 text-xl font-semibold">{draft.manifest.title}</h2><p className="text-sm">Version {draft.content_version} · {draft.manifest.outcomeStatement}</p>{draft.manifest.stages.map(stage => <section key={stage.id} className="mt-5 rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">{stage.title}</h3>{stage.activities.map(activity => <div key={activity.id} className="mt-4 border-t pt-4"><p className="mb-2 text-sm">{activity.instructions}</p>{activity.type === 'media' ? <><p>{activity.title}</p><button className="mt-2 rounded bg-master px-3 py-2 text-white" onClick={() => void resolveDraftModuleMedia(String(activity.payload.assetRef),draft.module_key,draft.content_version).then(value => setMedia(old => ({ ...old, [activity.id]: value.url }))).catch(cause => setError(cause.message))}>Load private media</button>{media[activity.id] && <iframe className="mt-3 aspect-video w-full" title={activity.title} src={media[activity.id]} allow="encrypted-media; picture-in-picture" />}</> : <GenericActivityPreview activity={activity} responses={responses} onResponse={(id,value) => setResponses(old => ({ ...old, [id]: value }))} recordings={recordings} onRecording={(id,url) => setRecordings(old => ({ ...old, [id]: url }))} />}</div>)}</section>)}</>}
  </main>;
}
