import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { InteractionRegistry } from '../modules/InteractionRegistry';
import { reeManifest, STAGES, type Stage } from '../modules/ree';
import { validReeActivityResponse } from '../modules/activityValidation';

type ResponseMap = Record<string, unknown>;
type Recording = { url: string; seconds: number };
const labels: Record<Stage, string> = {
  Discover: 'Khám phá', Learn: 'Học', Practice: 'Luyện tập',
  Apply: 'Áp dụng', Reflect: 'Tự đánh giá', Verify: 'Xác nhận',
};

/** No imports from coachingService, moduleService, Supabase or AudioPrompt: demo must never write remotely. */
export function AdminStudentDemo() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Stage[]>([]);
  const [mcq, setMcq] = useState<ResponseMap>({});
  const [matching, setMatching] = useState<ResponseMap>({});
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [matchingSubmitted, setMatchingSubmitted] = useState(false);
  const [reflection, setReflection] = useState<boolean[]>(Array(5).fill(false));
  const [recordings, setRecordings] = useState<Record<string, Recording>>({});
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('');
  const stage = STAGES[step];
  const next = () => {
    setCompleted((old) => old.includes(stage) ? old : [...old, stage]);
    setMessage('');
    if (step < STAGES.length - 1) setStep(step + 1);
    else setFinished(true);
  };
  const reset = () => {
    Object.values(recordings).forEach((item) => URL.revokeObjectURL(item.url));
    setRecordings({}); setStep(0); setCompleted([]); setMcq({}); setMatching({});
    setMcqSubmitted(false); setMatchingSubmitted(false); setReflection(Array(5).fill(false));
    setFinished(false); setMessage('');
  };
  // Object URLs and audio data stay in this browser tab; release them on unmount.
  const urls = useRef(new Set<string>());
  const saveRecording = (id: string, blob: Blob, seconds: number) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    setRecordings((previous) => {
      if (previous[id]) { URL.revokeObjectURL(previous[id].url); urls.current.delete(previous[id].url); }
      return { ...previous, [id]: { url, seconds } };
    });
  };
  useEffect(() => () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  const canContinue = stage !== 'Practice' || (mcqSubmitted && matchingSubmitted);

  return <div className="page-container pb-20 space-y-5">
    <Link to="/admin/modules" className="text-sm font-semibold text-emblue underline">← Quay lại quản lý module</Link>
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="font-bold text-amber-900">STUDENT DEMO · KHÔNG LƯU DỮ LIỆU</p>
      <p className="mt-1 text-sm text-amber-900">Mô phỏng trên trình duyệt. Không tạo task, không ghi Supabase, không nộp bài cho coach và không chấm điểm thật. Tải lại trang sẽ mất tiến độ và bản ghi âm.</p>
    </div>
    <header className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <p className="text-xs font-bold uppercase tracking-wide text-emblue">IELTS Speaking · {reeManifest.level} · {reeManifest.minutes} phút</p>
      <h1 className="mt-2 text-xl font-bold text-master sm:text-2xl">{reeManifest.title}</h1>
      <p className="mt-2 text-sm text-slate-700">{reeManifest.outcome}</p>
      <p className="mt-2 text-xs text-slate-500">Bản nội dung v{reeManifest.version} · Preview cho Admin</p>
    </header>
    <nav aria-label="Sáu giai đoạn học thử" className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      {STAGES.map((name, index) => <button key={name} type="button" onClick={() => { setStep(index); setFinished(false); setMessage(''); }}
        aria-current={stage === name ? 'step' : undefined}
        className={`rounded-xl border p-3 text-left text-xs ${step === index ? 'border-emblue bg-blue-50 font-bold text-master' : 'border-slate-200 bg-white text-slate-600'}`}>
        <span className="block">{index + 1}. {labels[name]}</span>
        <span className="mt-1 block">{completed.includes(name) ? 'Đã xem' : reeManifest.stageMinutes[name] + ' phút'}</span>
      </button>)}
    </nav>
    <main className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
      <h2 className="text-xl font-bold text-master">{step + 1}. {stage} · {labels[stage]}</h2>
      {finished && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm">Đã hoàn tất bản demo. Đây không phải kết quả mastery; coach chưa đánh giá.</p>}
      {stage === 'Discover' && <section className="mt-5 space-y-4">
        <p className="text-sm">Trả lời câu hỏi đầu vào, sau đó nghe lại bản ghi để so sánh ở cuối module.</p>
        <DemoRecorder id="discover" prompt={reeManifest.discoverPrompt} saved={recordings.discover} onSave={saveRecording} />
      </section>}
      {stage === 'Learn' && <section className="mt-5 space-y-5 text-sm">
        <p className="font-semibold text-master">Video bài giảng</p>
        {reeManifest.assets.filter((asset) => asset.stage === 'Learn').map((asset) =>
          <div key={asset.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold">Tài nguyên {asset.kind}: {asset.id}</p>
            <p className="mt-1">Quyền truy cập/phát video SharePoint chưa được xác minh cho học viên. Demo không tự nhận là đã phát được video.</p>
            <a href={asset.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-emblue underline">Mở tài nguyên gốc (có thể yêu cầu đăng nhập)</a>
          </div>)}
        {reeManifest.learn.introduction.map((line, i) => <p key={i}>{line}</p>)}
        <div className="grid gap-3 sm:grid-cols-3">{reeManifest.learn.layers.map((layer) =>
          <div key={layer.label} className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-bold text-master">{layer.label}</h3><p className="mt-2">{layer.text}</p><p className="mt-2 text-slate-500">{layer.language}</p>
          </div>)}</div>
        {reeManifest.learn.respondByQuestion.map((item) => <div key={item.kind} className="rounded-xl bg-slate-50 p-4">
          <h3 className="font-semibold">{item.kind}</h3><p className="mt-1">{item.method}</p><p className="mt-2 italic">{item.example}</p>
        </div>)}
        {reeManifest.learn.examples.map((item) => <div key={item.label} className="rounded-xl border p-4">
          <h3 className="font-semibold">{item.label} — {item.question}</h3>
          <p className="mt-2 text-slate-500">Trước: {item.before}</p>
          {item.after.map((line) => <p key={line} className="mt-2 border-l-2 border-emblue pl-3">{line}</p>)}
        </div>)}
        <p className="font-semibold text-master">{reeManifest.learn.conclusion}</p>
      </section>}
      {stage === 'Practice' && <section className="mt-5 space-y-6">
        <p className="text-sm">{reeManifest.practice.introduction}</p>
        <div><h3 className="font-semibold">{reeManifest.practice.mcq.title}</h3>
          <p className="mt-1 text-sm">{reeManifest.practice.mcq.instruction}</p>
          <InteractionRegistry definition={{ type: 'multiple_choice', id: 'ree-mcq', questions: reeManifest.practice.mcq.questions }}
            response={mcq} onChange={setMcq} disabled={mcqSubmitted} />
          <button type="button" disabled={!validReeActivityResponse('ree-mcq', mcq) || mcqSubmitted}
            onClick={() => setMcqSubmitted(true)} className="mt-3 rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Nộp bài 1 (mô phỏng)</button>
          {mcqSubmitted && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">Đã ghi nhận lựa chọn trong demo. Không có khóa đáp án riêng nên không chấm đúng/sai hay hiện giải thích giả.</p>}
        </div>
        <div><h3 className="font-semibold">{reeManifest.practice.matching.title}</h3>
          <p className="mt-1 text-sm">{reeManifest.practice.matching.instruction}</p>
          <InteractionRegistry definition={{ type: 'matching', id: 'ree-matching',
            responds: reeManifest.practice.matching.responds, explains: reeManifest.practice.matching.explains,
            examples: reeManifest.practice.matching.examples }} response={matching} onChange={setMatching} disabled={matchingSubmitted} />
          <button type="button" disabled={!validReeActivityResponse('ree-matching', matching) || matchingSubmitted}
            onClick={() => setMatchingSubmitted(true)} className="mt-3 rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Nộp bài 2 (mô phỏng)</button>
          {matchingSubmitted && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">Đã ghi nhận trong demo; không có điểm số thật. {reeManifest.practice.matching.conclusion}</p>}
        </div>
      </section>}
      {stage === 'Apply' && <section className="mt-5 space-y-5">
        <p className="text-sm">{reeManifest.apply.introduction}</p>
        {reeManifest.apply.prompts.map((prompt) => <DemoRecorder key={prompt.id} id={prompt.id}
          prompt={prompt.text} saved={recordings[prompt.id]} onSave={saveRecording} />)}
        <div className="rounded-xl bg-slate-50 p-4 text-sm">{reeManifest.apply.reminder.map((line) => <p key={line} className="mt-2">{line}</p>)}</div>
      </section>}
      {stage === 'Reflect' && <section className="mt-5 space-y-4">
        <p className="text-sm">{reeManifest.reflect.introduction}</p>
        {reeManifest.apply.prompts.map((prompt) => recordings[prompt.id] && <div key={prompt.id}>
          <p className="text-sm font-semibold">{prompt.text}</p><audio controls src={recordings[prompt.id].url} className="mt-2 w-full" />
        </div>)}
        {reeManifest.reflect.items.map((item, i) => <label key={item} className="flex gap-3 rounded-xl border p-3 text-sm">
          <input type="checkbox" checked={reflection[i]} onChange={(e) => setReflection((old) => old.map((v, j) => i === j ? e.target.checked : v))} />
          <span>{item}</span>
        </label>)}
      </section>}
      {stage === 'Verify' && <section className="mt-5 space-y-4">
        <p className="text-sm">{reeManifest.verify.introduction}</p>
        {reeManifest.verify.guidance.map((line) => <p key={line} className="text-sm">{line}</p>)}
        {recordings.discover && <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-semibold">Bản Discover để so sánh</p><audio controls src={recordings.discover.url} className="mt-2 w-full" />
        </div>}
        <DemoRecorder id="verify" prompt={reeManifest.verify.prompt} saved={recordings.verify} onSave={saveRecording} />
        <p className="rounded-xl bg-slate-50 p-4 text-sm">Mastery thật: ít nhất 6/8, không tiêu chí 0, Verify 20–30 giây và coach đánh giá. Demo không thực hiện chấm điểm.</p>
      </section>}
      {message && <p role="status" className="mt-4 text-sm text-amber-800">{message}</p>}
      <div className="mt-7 flex flex-wrap gap-3 border-t pt-5">
        {step > 0 && <button type="button" onClick={() => { setStep(step - 1); setFinished(false); }} className="rounded-lg border px-4 py-2 text-sm">Bước trước</button>}
        {!finished && <button type="button" disabled={!canContinue} onClick={next}
          className="rounded-lg bg-emblue px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {step === 5 ? 'Kết thúc demo (không nộp thật)' : 'Tiếp tục'}
        </button>}
        <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm">Làm lại demo</button>
      </div>
    </main>
  </div>;
}

function DemoRecorder({ id, prompt, saved, onSave }: {
  id: string; prompt: string; saved?: Recording;
  onSave: (id: string, blob: Blob, seconds: number) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const cleanup = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null; recorder.current = null;
  };
  useEffect(() => () => { if (recorder.current?.state === 'recording') recorder.current.onstop = null; recorder.current?.stop(); cleanup(); }, []);
  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt không hỗ trợ ghi âm. Bạn vẫn có thể xem tiếp demo.'); return;
    }
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = audio;
      const media = new MediaRecorder(audio);
      const chunks: BlobPart[] = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      media.onstop = () => {
        if (chunks.length) onSave(id, new Blob(chunks, { type: media.mimeType || 'audio/webm' }), Math.round((Date.now() - startedAt.current) / 1000));
        cleanup(); setRecording(false);
      };
      recorder.current = media; startedAt.current = Date.now(); media.start(); setRecording(true);
    } catch {
      cleanup(); setError('Không truy cập được micro. Hãy kiểm tra quyền trình duyệt; demo vẫn có thể tiếp tục.');
    }
  };
  return <div className="rounded-xl border border-slate-200 p-4">
    <p className="font-semibold text-master">{prompt}</p>
    <p className="mt-1 text-xs text-slate-500">Ghi âm chỉ lưu tạm trong tab này, không tải lên server.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {!recording ? <button type="button" onClick={() => void start()} className="rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white">Bắt đầu ghi âm</button> :
        <button type="button" onClick={() => recorder.current?.stop()} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Dừng và nghe lại</button>}
      {recording && <span role="status" className="text-sm text-red-700">Đang ghi âm…</span>}
    </div>
    {saved && <div className="mt-3"><p className="text-xs text-slate-500">Bản ghi tạm · khoảng {saved.seconds} giây</p>
      <audio controls src={saved.url} className="mt-2 w-full" /></div>}
    {error && <p role="alert" className="mt-2 text-sm text-amber-800">{error}</p>}
  </div>;
}
