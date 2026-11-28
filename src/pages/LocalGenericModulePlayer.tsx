import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getTask } from '../lib/coachingService';
import type { CoachingTask } from '../lib/types';
import { supabase } from '../lib/supabaseClient';
import { completeGenericStage, getGenericAssignment, requireLocalPilot, saveGenericRecording, saveGenericResponse, startGenericAttempt, submitGenericVerifyAtomic, type GenericAttempt } from '../lib/genericPilotService';
import { GenericActivityPreview } from '../modules/GenericActivityPreview';
import { activityResponse, type PublicActivity } from '../modules/genericEngine';
import { resolveAssignedModuleMedia } from '../modules/moduleMedia';
import { ModulePlayer } from './ModulePlayer';
import { REE_MODULE_ID } from '../modules/ree';

type Assignment = Awaited<ReturnType<typeof getGenericAssignment>>;
type SavedResponse = { activity_id: string; response: Record<string,unknown> };
type SavedRecording = { id: string; prompt_id: string; storage_path: string };

export function LocalGenericModulePlayer() {
  const { taskId } = useParams();
  const { profile } = useAuth();
  const [task,setTask]=useState<CoachingTask|null>(null);
  const [assignment,setAssignment]=useState<Assignment>(null);
  const [attempt,setAttempt]=useState<GenericAttempt|null>(null);
  const [stageIndex,setStageIndex]=useState(0);
  const [responses,setResponses]=useState<Record<string,string>>({});
  const [recordings,setRecordings]=useState<Record<string,string>>({});
  const [durations,setDurations]=useState<Record<string,number>>({});
  const [savedPrompts,setSavedPrompts]=useState<string[]>([]);
  const [inheritedPrompts,setInheritedPrompts]=useState<string[]>([]);
  const [media,setMedia]=useState<Record<string,{kind:string;url:string}>>({});
  const [answer,setAnswer]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const pendingPaths=useRef<Record<string,string>>({});
  const requestKeys=useRef<Record<string,string>>({});
  const manifest=assignment?.version.manifest;
  const stage=manifest?.stages[stageIndex];

  const loadAttempt=useCallback(async (current:GenericAttempt, currentAssignment:NonNullable<Assignment>) => {
    setAttempt(current);
    setStageIndex(Math.max(0,currentAssignment.version.manifest.stages.findIndex(item=>!current.completed_stages.includes(item.id))));
    const [{data:responseRows,error:responseError},{data:recordingRows,error:recordingError},{data:inheritedRows,error:inheritedError}]=await Promise.all([
      supabase.from('coaching_generic_responses').select('activity_id,response').eq('attempt_id',current.id),
      supabase.from('coaching_generic_recordings').select('id,prompt_id,storage_path').eq('attempt_id',current.id),
      supabase.from('coaching_generic_inherited_recordings').select('prompt_id,recording_id').eq('attempt_id',current.id),
    ]);
    if(responseError||recordingError||inheritedError)throw new Error(responseError?.message??recordingError?.message??inheritedError?.message);
    setResponses(Object.assign({},...(responseRows as SavedResponse[]).map(row=>Object.fromEntries(Object.entries(row.response).map(([key,value])=>[key,Array.isArray(value)?value.join(','):String(value)])))));
    setSavedPrompts((recordingRows as SavedRecording[]).map(row=>row.prompt_id));
    setInheritedPrompts((inheritedRows??[]).map(row=>row.prompt_id));
    const sources=[...(recordingRows as SavedRecording[]),...await Promise.all((inheritedRows??[]).map(async row=>{
      const {data,error}=await supabase.from('coaching_generic_recordings').select('id,prompt_id,storage_path').eq('id',row.recording_id).single();
      if(error)throw new Error(error.message); return data as SavedRecording;
    }))];
    const signed:Record<string,string>={};
    for(const row of sources){const {data,error}=await supabase.storage.from('coaching-submissions').createSignedUrl(row.storage_path,300);if(error)throw new Error(error.message);signed[row.prompt_id]=data.signedUrl;}
    setRecordings(signed);
  },[]);

  useEffect(()=>{if(!taskId||profile?.role!=='student')return;let active=true;void (async()=>{
    try{requireLocalPilot();const loadedTask=await getTask(taskId);
      if(loadedTask?.module_id===REE_MODULE_ID){if(active)setTask(loadedTask);return;}
      const loadedAssignment=await getGenericAssignment(taskId);
      if(!loadedTask||!loadedAssignment)throw new Error('Assigned generic task required.');
      if(!active)return;setTask(loadedTask);setAssignment(loadedAssignment);
      const {data,error}=await supabase.from('coaching_generic_attempts').select('*').eq('task_id',taskId).order('attempt_number',{ascending:false}).limit(1);
      if(error)throw new Error(error.message);if(active&&data?.[0])await loadAttempt(data[0] as GenericAttempt,loadedAssignment);
    }catch(error){if(active)setMessage(error instanceof Error?error.message:'Unable to load task.');}
  })();return()=>{active=false;};},[taskId,profile?.role,loadAttempt]);

  const run=async(action:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await action();setMessage('Saved to Supabase Local.');}catch(error){setMessage(error instanceof Error?error.message:'Local action failed.');}finally{setBusy(false);}};
  if(!profile||profile.role!=='student'||!taskId)return <p className="page-container">Assigned local student required.</p>;
  if(task?.module_id===REE_MODULE_ID)return <ModulePlayer/>;
  if(!task||!assignment||!manifest)return <p className="page-container" role="status">{message||'Loading assigned module…'}</p>;

  const saveActivity=async(activity:PublicActivity)=>{
    if(!attempt)throw new Error('Start the module first.');
    if(activity.type==='recording'){
      for(const prompt of activity.payload.prompts as {id:string}[]){
        if(inheritedPrompts.includes(prompt.id)||savedPrompts.includes(prompt.id))continue;
        const url=recordings[prompt.id],seconds=durations[prompt.id];
        if(!url||!Number.isInteger(seconds)||seconds<1)throw new Error(`Record ${prompt.id} before saving.`);
        const path=pendingPaths.current[prompt.id]??`${profile.id}/${task.id}/${attempt.id}/${crypto.randomUUID()}.webm`;
        if(!pendingPaths.current[prompt.id]){
          const blob=new Blob([await (await fetch(url)).blob()],{type:'audio/webm'});
          const {error}=await supabase.storage.from('coaching-submissions').upload(path,blob,{contentType:'audio/webm'});
          if(error)throw new Error(error.message);pendingPaths.current[prompt.id]=path;
        }
        await saveGenericRecording(attempt.id,prompt.id,path,seconds);
        setSavedPrompts(old=>[...old,prompt.id]);delete pendingPaths.current[prompt.id];
      }
    }else await saveGenericResponse(attempt.id,activity.id,activityResponse(activity,responses));
  };
  return <main className="page-container space-y-5"><header><p className="text-xs uppercase">Supabase Local · assigned module</p><h1 className="text-2xl font-bold">{manifest.title}</h1><p className="text-sm">{task.title} · {task.instructions}</p><p className="text-xs">Content version {assignment.assignment.content_version} · Module objective: {manifest.outcomeStatement}</p></header>
    {!attempt&&<button className="rounded bg-master px-4 py-2 text-white" onClick={()=>void run(async()=>{await loadAttempt(await startGenericAttempt(task.id),assignment);})}>Start module</button>}
    {attempt&&<><p role="status">Attempt {attempt.id.slice(0,8)} · {attempt.status}</p><nav aria-label="Module stages" className="flex flex-wrap gap-2">{manifest.stages.map((item,index)=><button key={item.id} disabled={index>stageIndex&&!attempt.completed_stages.includes(item.id)} aria-current={index===stageIndex?'step':undefined} className="rounded border px-3 py-2" onClick={()=>setStageIndex(index)}>{item.title}{attempt.completed_stages.includes(item.id)?' ✓':''}</button>)}</nav>
      {stage&&<section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{stage.title}</h2>{stage.activities.map(activity=><div key={activity.id} className="mt-5 border-t pt-4"><p className="mb-2 text-sm">{activity.instructions}</p>{activity.type==='media'?<><button className="rounded border px-3 py-2" onClick={()=>void run(async()=>{const value=await resolveAssignedModuleMedia(String(activity.payload.assetRef),task.id,assignment.assignment.module_key,assignment.assignment.content_version);setMedia(old=>({...old,[activity.id]:value}));})}>Load assigned media</button>{media[activity.id]?.kind==='youtube'&&<iframe title={activity.title} className="mt-3 aspect-video w-full" src={media[activity.id].url}/ >}{media[activity.id]?.kind==='audio'&&<audio controls src={media[activity.id].url}/>}</>:<GenericActivityPreview activity={activity} responses={responses} onResponse={(id,value)=>setResponses(old=>({...old,[id]:value}))} recordings={recordings} onRecording={(id,url,seconds)=>{setRecordings(old=>({...old,[id]:url}));if(seconds)setDurations(old=>({...old,[id]:seconds}));}} polished/>}
        {['choice','matching','text_response','reflection','recording'].includes(activity.type)&&<button disabled={busy} className="mt-3 rounded border px-3 py-2" onClick={()=>void run(()=>saveActivity(activity))}>Save {activity.title}</button>}</div>)}
        {stage.id!=='Verify'&&<button disabled={busy||attempt.status!=='in_progress'} className="mt-5 rounded bg-master px-4 py-2 text-white" onClick={()=>void run(async()=>{const updated=await completeGenericStage(attempt.id,stage.id);setAttempt(updated);setStageIndex(Math.min(stageIndex+1,manifest.stages.length-1));})}>Complete stage</button>}
        {stage.id==='Verify'&&attempt.status==='in_progress'&&<><label className="mt-5 block text-sm">Your Verify response<textarea className="mt-1 w-full rounded border p-2" value={answer} onChange={event=>setAnswer(event.target.value)}/></label><button disabled={busy} className="mt-3 rounded bg-master px-4 py-2 text-white" onClick={()=>void run(async()=>{if(!answer.trim())throw new Error('Enter your response.');await submitGenericVerifyAtomic(attempt.id,answer,requestKeys.current[attempt.id]??=crypto.randomUUID());const updated={...attempt,status:'awaiting_review'};setAttempt(updated);})}>Submit evidence</button></>}
      </section>}
    </>}{message&&<p role="status" className="rounded bg-sky-50 p-3 text-sm">{message}</p>}
  </main>;
}

