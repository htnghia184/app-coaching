import { useEffect, useRef, useState } from 'react';
import type { PublicActivity } from './genericEngine';

export function GenericActivityPreview({ activity, responses, onResponse, recordings, onRecording }: {
  activity: PublicActivity; responses: Record<string,string>; onResponse: (id:string,value:string)=>void;
  recordings: Record<string,string>; onRecording: (id:string,url:string)=>void;
}) {
  const p = activity.payload;
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
