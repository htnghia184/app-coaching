import { useEffect, useRef, useState } from 'react';
import type { PublicActivity } from './genericEngine';

export function GenericActivityPreview({ activity, responses, onResponse, recordings, onRecording, polished = false }: {
  activity: PublicActivity; responses: Record<string,string>; onResponse: (id:string,value:string)=>void;
  recordings: Record<string,string>; onRecording: (id:string,url:string)=>void; polished?: boolean;
}) {
  const p = activity.payload;
  if (polished) return <LearnerActivity activity={activity} responses={responses} onResponse={onResponse} recordings={recordings} onRecording={onRecording}/>;
  if (activity.type === 'lesson') return <article><h3 className="font-semibold">{activity.title}</h3>{(p.blocks as {id:string;kind:string;text:string}[]).map(block => <p key={block.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">{block.kind}: {block.text}</p>)}</article>;
  if (activity.type === 'media') return <article className="rounded-lg bg-slate-100 p-4"><h3 className="font-semibold">{activity.title}</h3><p className="mt-2 text-sm">Private {String(p.kind)} asset {String(p.assetRef)} is not configured in this public preview. Publication stays blocked until authorized resolver and media QA pass.</p></article>;
  if (activity.type === 'choice') return <article><h3 className="font-semibold">{activity.title}</h3>{(p.items as {id:string;prompt:string;fields:{id:string;mode:string;options:{id:string;text:string}[]}[]}[]).map(item => <div key={item.id} className="mt-3 rounded-lg border p-3"><p className="text-sm">{item.prompt}</p>{item.fields.map(field => { const key = `${item.id}-${field.id}`; const selected = responses[key]?.split(',').filter(Boolean) ?? []; return <fieldset key={field.id} className="mt-2"><legend className="text-xs font-semibold">{field.mode} choice</legend>{field.options.map(option => <label key={option.id} className="mr-3 inline-flex gap-1 text-sm"><input type={field.mode === 'multi' ? 'checkbox' : 'radio'} name={`${activity.id}-${key}`} checked={selected.includes(option.id)} onChange={() => onResponse(key,field.mode === 'multi' ? (selected.includes(option.id) ? selected.filter(id => id !== option.id) : [...selected, option.id]).join(',') : option.id)} />{option.text}</label>)}</fieldset>; })}</div>)}</article>;
  if (activity.type === 'matching') return <article><h3 className="font-semibold">{activity.title}</h3>{(p.prompts as {id:string;text:string}[]).map(prompt => <div key={prompt.id} className="mt-3 rounded-lg border p-3"><p className="text-sm">{prompt.text}</p>{(p.groups as {id:string;options:{id:string;text:string}[]}[]).map(group => <label key={group.id} className="mt-2 block text-sm">{group.id}<select className="ml-2 rounded border p-1" value={responses[`${prompt.id}-${group.id}`] ?? ''} onChange={event => onResponse(`${prompt.id}-${group.id}`,event.target.value)}><option value="">Choose</option>{group.options.map(option => <option key={option.id} value={option.id}>{option.text}</option>)}</select></label>)}</div>)}</article>;
  if (activity.type === 'text_response') return <article><h3 className="font-semibold">{activity.title}</h3>{(p.fields as {id:string;prompt:string;mode:string}[]).map(field => <label key={field.id} className="mt-3 block text-sm">{field.prompt}<small className="block text-slate-500">{field.mode === 'open_response' ? 'Coach or exemplar review; no exact-match grade' : 'Private accepted variants required for grading'}</small><textarea className="mt-1 block w-full rounded border p-2" value={responses[field.id] ?? ''} onChange={event => onResponse(field.id,event.target.value)} /></label>)}</article>;
  if (activity.type === 'recording') return <article><h3 className="font-semibold">{activity.title}</h3>{(p.prompts as {id:string;text:string}[]).map(prompt => <Recorder key={prompt.id} id={prompt.id} text={prompt.text} url={recordings[prompt.id]} onRecording={onRecording} />)}</article>;
  if (activity.type === 'reflection') return <article><h3 className="font-semibold">{activity.title} · self-check, unscored</h3>{(p.items as {id:string;text:string}[]).map(item => <label key={item.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={responses[item.id] === 'yes'} onChange={event => onResponse(item.id,event.target.checked ? 'yes' : '')} />{item.text}</label>)}</article>;
  return <article><h3 className="font-semibold">{activity.title}</h3><p className="text-sm">References existing evidence; no duplicate recording or server submission in preview.</p>{(p.evidenceItemIds as string[]).map(id => <p key={id} className="mt-2 text-sm">{id}: {recordings[id] ? <audio controls src={recordings[id]} /> : 'Recording pending'}</p>)}</article>;
}

function Recorder({ id, text, url, onRecording }: { id:string;text:string;url?:string;onRecording:(id:string,url:string)=>void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => () => { if (recorder.current?.state === 'recording') recorder.current.stop(); recorder.current?.stream.getTracks().forEach(track => track.stop()); }, []);
  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      recorder.current = media; chunks.current = [];
      media.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = () => { onRecording(id,URL.createObjectURL(new Blob(chunks.current,{type:media.mimeType}))); stream.getTracks().forEach(track => track.stop()); setRecording(false); };
      media.start(); setRecording(true);
    } catch { setError('Microphone unavailable or permission denied.'); }
  };
  return <div className="mt-3 rounded-lg border p-3"><p className="text-sm">{text}</p><button type="button" className="mt-2 rounded bg-master px-3 py-2 text-sm text-white" onClick={recording ? () => recorder.current?.stop() : start}>{recording ? 'Stop recording' : url ? 'Record again' : 'Record'}</button>{url && <audio className="mt-2" controls src={url} />}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}

type PreviewProps = { activity: PublicActivity; responses: Record<string,string>; onResponse:(id:string,value:string)=>void; recordings:Record<string,string>; onRecording:(id:string,url:string)=>void };
const heading = 'text-lg font-bold text-master';
const card = 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5';
function LearnerActivity({activity,responses,onResponse,recordings,onRecording}:PreviewProps) {
  const p=activity.payload;
  return <article className="space-y-4">
    <h3 className={heading}>{activity.title}</h3>
    {activity.type==='lesson' && (p.blocks as {id:string;kind:string;text:string}[]).map(block=><div key={block.id} className={block.kind==='callout'||block.kind==='example'?'rounded-2xl border-l-4 border-emblue bg-sky-50 p-5':card}>
      {block.kind!=='paragraph'&&<p className="mb-2 text-xs font-bold uppercase tracking-wider text-emblue">{block.kind}</p>}
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{block.text}</p>
    </div>)}
    {activity.type==='choice' && (p.items as {id:string;prompt:string;fields:{id:string;mode:string;options:{id:string;text:string}[]}[]}[]).map(item=><div key={item.id} className="space-y-5">
      <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-lg font-semibold leading-relaxed text-master">{item.prompt}</p>
      {item.fields.map((field,index)=>{const key=item.id+'-'+field.id;const chosen=responses[key]?.split(',').filter(Boolean)??[];return <fieldset key={field.id} className="space-y-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">{item.fields.length>1?'Part '+(index+1)+' · ':''}{field.mode==='multi'?'Choose all that apply':'Choose one answer'}</legend>
        {field.options.map((option,i)=>{const checked=chosen.includes(option.id);return <label key={option.id} className={'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-emblue '+(checked?'border-emblue bg-sky-50':'border-slate-200 hover:border-sky-200')}>
          <input className="mt-1 shrink-0 accent-master" type={field.mode==='multi'?'checkbox':'radio'} name={activity.id+'-'+key} checked={checked} onChange={()=>onResponse(key,field.mode==='multi'?(checked?chosen.filter(x=>x!==option.id):[...chosen,option.id]).join(','):option.id)}/>
          <span className="shrink-0 font-bold text-master">{String.fromCharCode(65+i)}.</span><span>{option.text}</span>
        </label>;})}
      </fieldset>;})}
    </div>)}
    {activity.type==='matching' && (p.prompts as {id:string;text:string}[]).map(prompt=><div key={prompt.id} className="space-y-4">
      <p className="rounded-2xl bg-master p-5 text-lg font-semibold text-white whitespace-pre-wrap">{prompt.text}</p>
      {(p.groups as {id:string;options:{id:string;text:string}[]}[]).map(group=><fieldset key={group.id} className="space-y-2"><legend className="mb-2 text-sm font-semibold text-master">{group.id}</legend>{group.options.map(option=><label key={option.id} className={'flex cursor-pointer gap-3 rounded-xl border-2 p-3 text-sm '+(responses[prompt.id+'-'+group.id]===option.id?'border-emblue bg-sky-50':'border-slate-200')}><input type="radio" className="accent-master" name={activity.id+'-'+prompt.id+'-'+group.id} checked={responses[prompt.id+'-'+group.id]===option.id} onChange={()=>onResponse(prompt.id+'-'+group.id,option.id)}/>{option.text}</label>)}</fieldset>)}
    </div>)}
    {activity.type==='text_response' && (p.fields as {id:string;prompt:string;mode:string}[]).map(field=><label key={field.id} className="block space-y-3"><span className="block whitespace-pre-wrap text-base font-semibold text-master">{field.prompt}</span><textarea rows={field.mode==='open_response'?5:2} placeholder="Write your response here…" className="block w-full rounded-xl border border-slate-300 p-4 text-sm focus:border-emblue focus:outline-none focus:ring-1 focus:ring-emblue" value={responses[field.id]??''} onChange={e=>onResponse(field.id,e.target.value)}/><span className="block text-xs text-slate-500">{(responses[field.id]??'').length} characters · Draft response</span></label>)}
    {activity.type==='recording' && (p.prompts as {id:string;text:string}[]).map((prompt,i)=><StudioRecorder key={prompt.id} id={prompt.id} text={prompt.text} number={i+1} target={typeof p.targetSeconds==='number'?p.targetSeconds:undefined} url={recordings[prompt.id]} onRecording={onRecording}/>)}
    {activity.type==='reflection' && <div className="space-y-2"><p className="text-sm text-slate-500">Self-assessment · Not scored</p>{(p.items as {id:string;text:string}[]).map(item=><label key={item.id} className={'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed '+(responses[item.id]==='yes'?'border-emblue bg-sky-50':'border-slate-200')}><input type="checkbox" className="mt-1 h-4 w-4 accent-master" checked={responses[item.id]==='yes'} onChange={e=>onResponse(item.id,e.target.checked?'yes':'no')}/><span>{item.text}</span></label>)}</div>}
    {activity.type==='evidence_submit' && <div className="space-y-3"><p className="text-sm text-slate-600">Review your recordings before finishing. Nothing is submitted to a coach in this demo.</p>{(p.evidenceItemIds as string[]).map((id,i)=><div key={id} className={card}><p className="text-sm font-semibold text-master">Recording {i+1} · {recordings[id]?'Ready to review':'Not recorded'}</p>{recordings[id]&&<audio className="mt-3 w-full" controls src={recordings[id]}/>}</div>)}</div>}
    {activity.type==='media' && <p className="text-sm text-slate-500">Media requires authorized preview.</p>}
    {['choice','matching','text_response'].includes(activity.type)&&<p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Review mode: responses are temporary. Correct-answer feedback is not available in this preview.</p>}
  </article>;
}

function StudioRecorder({id,text,number,target,url,onRecording}:{id:string;text:string;number:number;target?:number;url?:string;onRecording:(id:string,url:string)=>void}) {
  const [status,setStatus]=useState<'idle'|'requesting'|'recording'>('idle');
  const [elapsed,setElapsed]=useState(0);
  const [error,setError]=useState('');
  const media=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const alive=useRef(true);
  const startTime=useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(media.current){media.current.onstop=null;if(media.current.state!=='inactive')media.current.stop();}stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  useEffect(()=>{if(status!=='recording')return;const timer=window.setInterval(()=>setElapsed(Math.floor((performance.now()-startTime.current)/1000)),200);return()=>window.clearInterval(timer);},[status]);
  const start=async()=>{
    setError('');setStatus('requesting');
    try {
      const audio=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!alive.current){audio.getTracks().forEach(t=>t.stop());return;}
      stream.current=audio;
      const rec=new MediaRecorder(audio);media.current=rec;
      const chunks:BlobPart[]=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onstop=()=>{audio.getTracks().forEach(t=>t.stop());stream.current=null;media.current=null;if(!alive.current)return;if(chunks.length)onRecording(id,URL.createObjectURL(new Blob(chunks,{type:rec.mimeType||'audio/webm'})));else setError('No audio captured. Try again.');setStatus('idle');};
      startTime.current=performance.now();setElapsed(0);rec.start();setStatus('recording');
    }catch{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(alive.current){setError('Microphone unavailable or permission denied. Check browser permissions.');setStatus('idle');}}
  };
  return <section className="overflow-hidden rounded-2xl border border-slate-200">
    <div className="bg-master p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-sky-200">Speaking studio · {number}</p><p className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-relaxed">{text}</p></div>
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-mono text-2xl font-semibold tabular-nums text-master">{String(Math.floor(elapsed/60)).padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')}</span>{target&&<span className="text-xs text-slate-500">Target: {target}s · guidance only</span>}</div>
      <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={status==='requesting'} onClick={status==='recording'?()=>{if(media.current?.state==='recording')media.current.stop();}:()=>void start()} className={'rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 '+(status==='recording'?'bg-red-700':'bg-master')}>{status==='recording'?'Stop recording':status==='requesting'?'Requesting microphone…':url?'Record again':'Record'}</button>{status==='recording'&&<span role="status" className="text-sm text-red-700">Recording…</span>}</div>
      {url&&<div className="rounded-xl bg-sky-50 p-3"><p className="mb-2 text-xs font-semibold text-master">Listen to your recording</p><audio className="w-full" controls src={url}/></div>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-slate-500">Audio stays in this tab. Timer is a preview aid, not a verified duration measurement.</p>
    </div>
  </section>;
}
