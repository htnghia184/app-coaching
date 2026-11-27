import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDateTime } from '../lib/format';
import type { SubmissionRevision, CoachingTask } from '../lib/types';
import { EvidenceAttachment } from './AttachmentLink';

export const localOutcomeEnabled = import.meta.env.DEV && /^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(import.meta.env.VITE_SUPABASE_URL ?? '');
type Catalog = {id:string;version:number;statement:string;success_criteria:string;active:boolean};
type Priority = {outcome_id:string;outcome_version:number;priority:number;rationale:string;checkpoint_on:string|null;active:boolean};
type Assessment = {id:string;outcome_id:string;outcome_version:number;status:string;rationale:string;feedback:string;assessed_by:string;assessed_at:string};
type Evidence = {id:string;outcome_id:string;outcome_version:number;summary:string;source_type:string;submission_revision_id:string|null;captured_at:string};
type Session = {id:string;summary:string|null};
const key=(id:string,version:number)=>id+':'+version;
const label:Record<string,string>={not_assessed:'Chưa đánh giá',emerging:'Mới hình thành',developing:'Đang phát triển',demonstrated:'Đã thể hiện',needs_recheck:'Cần đánh giá lại'};
const input='mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm';
function checked<T>(result:{data:T|null;error:{message:string}|null}):T{if(result.error)throw new Error(result.error.message);if(result.data===null)throw new Error('Không có dữ liệu');return result.data;}

export function LearnerOutcomeProfile({enrollmentId,revisions,tasks}:{enrollmentId:string;revisions:SubmissionRevision[];tasks:CoachingTask[]}) {
  const [catalog,setCatalog]=useState<Catalog[]>([]);
  const [priorities,setPriorities]=useState<Priority[]>([]);
  const [assessments,setAssessments]=useState<Assessment[]>([]);
  const [evidence,setEvidence]=useState<Evidence[]>([]);
  const [sessions,setSessions]=useState<Session[]>([]);
  const [links,setLinks]=useState<{assessment_id:string;evidence_id:string}[]>([]);
  const [selected,setSelected]=useState('');
  const [rank,setRank]=useState('1');
  const [priorityReason,setPriorityReason]=useState('');
  const [checkpoint,setCheckpoint]=useState('');
  const [source,setSource]=useState('');
  const [summary,setSummary]=useState('');
  const [selectedEvidence,setSelectedEvidence]=useState<string[]>([]);
  const [status,setStatus]=useState('developing');
  const [rationale,setRationale]=useState('');
  const [feedback,setFeedback]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [ready,setReady]=useState(false);
  const load=useCallback(async()=>{
    setError('');
    try{
      const [c,p,a,e,s]=await Promise.all([
        supabase.from('coaching_learning_outcomes').select('id,version,statement,success_criteria,active'),
        supabase.from('coaching_enrollment_outcomes').select('outcome_id,outcome_version,priority,rationale,checkpoint_on,active').eq('enrollment_id',enrollmentId).order('priority'),
        supabase.from('coaching_outcome_assessments').select('id,outcome_id,outcome_version,status,rationale,feedback,assessed_by,assessed_at').eq('enrollment_id',enrollmentId).order('assessed_at',{ascending:false}),
        supabase.from('coaching_outcome_evidence').select('id,outcome_id,outcome_version,summary,source_type,submission_revision_id,captured_at').eq('enrollment_id',enrollmentId).order('captured_at',{ascending:false}),
        supabase.from('coaching_sessions').select('id,summary').eq('enrollment_id',enrollmentId)
      ]);
      const cc=checked(c) as Catalog[],pp=checked(p) as Priority[],aa=checked(a) as Assessment[],ee=checked(e) as Evidence[],ss=checked(s) as Session[];
      const ll=aa.length?checked(await supabase.from('coaching_assessment_evidence').select('assessment_id,evidence_id').in('assessment_id',aa.map(x=>x.id))):[];
      setCatalog(cc);setPriorities(pp);setAssessments(aa);setEvidence(ee);setSessions(ss);setLinks(ll);setReady(true);
    }catch(err){setError(err instanceof Error?err.message:'Không tải được LO profile');}
  },[enrollmentId]);
  useEffect(()=>{if(localOutcomeEnabled)void load();},[load]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();await load();}catch(err){setError(err instanceof Error?err.message:'Không lưu được');}finally{setBusy(false);}};
  if(!localOutcomeEnabled)return null;
  const outcome=catalog.find(x=>key(x.id,x.version)===selected);
  const active=priorities.filter(p=>p.active);
  const current=active.find(p=>key(p.outcome_id,p.outcome_version)===selected);
  const relevant=evidence.filter(e=>key(e.outcome_id,e.outcome_version)===selected);
  const direct=revisions.filter(r=>r.submitted_at&&tasks.some(t=>t.id===r.task_id&&!t.module_id));
  const select=(value:string)=>{setSelected(value);setSelectedEvidence([]);setSource('');setSummary('');setRationale('');setFeedback('');setStatus('developing');const p=active.find(x=>key(x.outcome_id,x.outcome_version)===value);setRank(String(p?.priority??1));setPriorityReason(p?.rationale??'');setCheckpoint(p?.checkpoint_on??'');};
  return <section className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
    <header><h2 className="text-lg font-bold text-master">Hồ sơ năng lực học viên</h2><p className="mt-1 text-sm text-slate-500">LO độc lập với module. Coach quyết định dựa trên evidence, không dựa vào số bài hoàn thành.</p><p className="mt-1 text-xs text-amber-700">Supabase Local · danh mục LO thử nghiệm, chưa phê duyệt học thuật.</p></header>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!ready?<button onClick={()=>void load()} className="text-sm underline">Tải lại hồ sơ</button>:<>
    <div className="grid gap-3 sm:grid-cols-2">{active.map(p=>{const k=key(p.outcome_id,p.outcome_version);const c=catalog.find(x=>key(x.id,x.version)===k);const a=assessments.find(x=>key(x.outcome_id,x.outcome_version)===k);return <button key={k} type="button" onClick={()=>select(k)} className={'rounded-xl border p-4 text-left '+(selected===k?'border-emblue bg-sky-50':'border-slate-200')}><p className="text-xs font-semibold text-emblue">Ưu tiên {p.priority} · {label[a?.status??'not_assessed']}</p><p className="mt-2 font-semibold text-master">{c?.statement??k}</p><p className="mt-1 text-sm text-slate-600">{p.rationale}</p>{p.checkpoint_on&&<p className="mt-2 text-xs">Đánh giá lại: {p.checkpoint_on}</p>}</button>;})}</div>
    {!active.length&&<p className="text-sm text-slate-500">Chưa có LO ưu tiên. Chọn từ danh mục hiện có.</p>}
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold text-master">Thiết lập ưu tiên</h3>
      <label className="block text-sm">Năng lực<select className={input} value={selected} onChange={e=>select(e.target.value)}><option value="">Chọn LO</option>{catalog.filter(c=>c.active||active.some(p=>key(p.outcome_id,p.outcome_version)===key(c.id,c.version))).map(c=><option key={key(c.id,c.version)} value={key(c.id,c.version)}>{c.statement} · v{c.version}</option>)}</select></label>
      {outcome&&<><p className="rounded-lg bg-slate-50 p-3 text-sm">Tiêu chí: {outcome.success_criteria}</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Thứ tự ưu tiên<input className={input} type="number" min="1" value={rank} onChange={e=>setRank(e.target.value)}/></label><label className="text-sm">Ngày kiểm tra lại<input className={input} type="date" value={checkpoint} onChange={e=>setCheckpoint(e.target.value)}/></label></div><label className="block text-sm">Lý do từ chẩn đoán<textarea className={input} value={priorityReason} onChange={e=>setPriorityReason(e.target.value)}/></label><button disabled={busy||!outcome.active} className="rounded-lg bg-master px-4 py-2 text-sm text-white disabled:opacity-50" onClick={()=>void run(async()=>{if(!priorityReason.trim()||!Number.isInteger(Number(rank))||Number(rank)<1)throw new Error('Nhập lý do và thứ tự hợp lệ');checked(await supabase.rpc('set_coaching_outcome_priority',{p_enrollment:enrollmentId,p_outcome:outcome.id,p_version:outcome.version,p_priority:Number(rank),p_rationale:priorityReason,p_checkpoint:checkpoint||null}));})}>Lưu ưu tiên</button>{current&&<button disabled={busy} className="ml-3 text-sm underline" onClick={()=>void run(async()=>{checked(await supabase.rpc('deactivate_coaching_outcome_priority',{p_enrollment:enrollmentId,p_outcome:outcome.id,p_version:outcome.version}));})}>Bỏ ưu tiên</button>}</>}
    </div>
    {outcome&&current&&<div className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold text-master">Evidence và đánh giá năng lực</h3><label className="block text-sm">Nguồn evidence<select className={input} value={source} onChange={e=>setSource(e.target.value)}><option value="">Chọn bài nộp hoặc buổi coaching</option>{direct.map(r=><option key={r.id} value={'revision:'+r.id}>{tasks.find(t=>t.id===r.task_id)?.title} · lần {r.revision_number}</option>)}{sessions.filter(s=>s.summary?.trim()).map(s=><option key={s.id} value={'session:'+s.id}>Coaching: {s.summary?.slice(0,90)}</option>)}</select></label>
    <p className="text-xs text-slate-500">Evidence module sẽ bổ sung sau khi xác minh liên kết phiên bản. Bài trực tiếp và ghi chú buổi học không cần module.</p>
    <label className="block text-sm">Quan sát từ evidence<textarea className={input} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
    <button disabled={busy||!source||!summary.trim()} className="rounded-lg border px-4 py-2 text-sm font-semibold text-master disabled:opacity-50" onClick={()=>void run(async()=>{const [kind,id]=source.split(':');if(kind==='revision'?!direct.some(r=>r.id===id):kind!=='session'||!sessions.some(s=>s.id===id&&s.summary?.trim()))throw new Error('Nguồn evidence không hợp lệ');checked(await supabase.rpc('record_coaching_outcome_evidence',{p_enrollment:enrollmentId,p_outcome:outcome.id,p_version:outcome.version,p_revision:kind==='revision'?id:null,p_source_type:kind==='revision'?'task_submission':'live_session_note',p_module:null,p_module_version:null,p_session:kind==='session'?id:null,p_summary:summary.trim()}));setSummary('');setSource('');})}>Gắn evidence vào LO</button>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">Chọn một hoặc nhiều evidence để đánh giá</legend>{relevant.map(e=>{const rev=revisions.find(r=>r.id===e.submission_revision_id);return <div key={e.id} className="rounded-lg border p-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={selectedEvidence.includes(e.id)} onChange={ev=>setSelectedEvidence(old=>ev.target.checked?[...old,e.id]:old.filter(id=>id!==e.id))}/><span>{e.summary}<small className="block text-slate-500">{formatDateTime(e.captured_at)}</small></span></label>{rev?.text_response&&<p className="mt-2 whitespace-pre-wrap text-sm">{rev.text_response}</p>}{rev?.storage_path&&<EvidenceAttachment path={rev.storage_path} audio={rev.duration_seconds!==null}/>}</div>;})}</fieldset>
    <label className="block text-sm">Trạng thái<select className={input} value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(label).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label className="block text-sm">Lý do đánh giá<textarea className={input} value={rationale} onChange={e=>setRationale(e.target.value)}/></label><label className="block text-sm">Feedback<textarea className={input} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label>
    <button disabled={busy||!selectedEvidence.length||!rationale.trim()||!feedback.trim()} className="rounded-lg bg-master px-4 py-2 text-sm text-white disabled:opacity-50" onClick={()=>void run(async()=>{checked(await supabase.rpc('record_coaching_outcome_assessment',{p_enrollment:enrollmentId,p_outcome:outcome.id,p_version:outcome.version,p_status:status,p_rationale:rationale.trim(),p_feedback:feedback.trim(),p_evidence_ids:selectedEvidence}));setSelectedEvidence([]);setRationale('');setFeedback('');})}>Lưu đánh giá mới</button></div>}
    <div className="space-y-2"><h3 className="font-semibold text-master">Lịch sử đánh giá năng lực</h3>{assessments.length===0&&<p className="text-sm text-slate-500">Chưa có đánh giá.</p>}{assessments.map(a=><details key={a.id} className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">{catalog.find(c=>key(c.id,c.version)===key(a.outcome_id,a.outcome_version))?.statement??a.outcome_id} · {label[a.status]??a.status} · {formatDateTime(a.assessed_at)}</summary><p className="mt-2">{a.rationale}</p><p className="mt-1">{a.feedback}</p><p className="mt-1 text-xs text-slate-500">Coach: {a.assessed_by}</p>{links.filter(l=>l.assessment_id===a.id).map(l=><p key={l.evidence_id} className="mt-1 text-xs">Evidence: {evidence.find(e=>e.id===l.evidence_id)?.summary??l.evidence_id}</p>)}</details>)}</div>
    <div className="rounded-xl bg-sky-50 p-4 text-sm"><h3 className="font-semibold text-master">Gợi ý cho kế hoạch tuần</h3>{active.map(p=>{const a=assessments.find(x=>key(x.outcome_id,x.outcome_version)===key(p.outcome_id,p.outcome_version));return <p key={key(p.outcome_id,p.outcome_version)} className="mt-2">{catalog.find(c=>key(c.id,c.version)===key(p.outcome_id,p.outcome_version))?.statement??p.outcome_id}: {a?.status==='demonstrated'?'Cân nhắc duy trì hoặc chuyển trọng tâm':a?.status==='needs_recheck'?'Giao nhiệm vụ kiểm tra lại':a?'Giao bài luyện tập theo feedback gần nhất':'Thu evidence chẩn đoán trước'}.</p>;})}<a href="#weekly-plan" className="mt-3 inline-block font-semibold text-emblue underline">Mở kế hoạch tuần ↓</a><p className="mt-2 text-xs text-slate-500">Gợi ý theo trạng thái coach đã ghi nhận; không tự giao bài.</p></div>
    </>}
  </section>;
}
