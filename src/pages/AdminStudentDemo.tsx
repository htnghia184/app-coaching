import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { reeManifest, STAGES, type Stage } from '../modules/ree';

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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [learnTab, setLearnTab] = useState(0);
  const [showLearnNotes, setShowLearnNotes] = useState(false);
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
    setFinished(false); setMessage(''); setQuestionIndex(0); setLearnTab(0); setShowLearnNotes(false);
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

  const questions = reeManifest.practice.mcq.questions;
  const matchingItems = reeManifest.practice.matching;
  const practiceTotal = questions.length + matchingItems.responds.length;
  const practiceIsMcq = questionIndex < questions.length;
  const practiceDone = questionIndex >= practiceTotal;
  const currentQuestion = practiceIsMcq ? questions[questionIndex] : null;
  const currentMatch = !practiceIsMcq && !practiceDone ? matchingItems.responds[questionIndex - questions.length] : null;
  const currentMcqAnswer = currentQuestion ? (mcq[currentQuestion.id] ?? {}) as { choice?: string; stage?: string } : null;
  const currentMatchAnswer = currentMatch ? (matching[currentMatch.id] ?? {}) as { explain?: string; example?: string } : null;
  const canAdvancePractice = practiceIsMcq ? Boolean(currentMcqAnswer?.choice && currentMcqAnswer.stage) :
    Boolean(currentMatchAnswer?.explain && currentMatchAnswer.example);
  const chooseMcq = (key: 'choice' | 'stage', value: string) => {
    if (!currentQuestion) return;
    setMcq((old) => ({ ...old, [currentQuestion.id]: { ...((old[currentQuestion.id] ?? {}) as object), [key]: value } }));
  };
  const chooseMatch = (key: 'explain' | 'example', value: string) => {
    if (!currentMatch) return;
    setMatching((old) => ({ ...old, [currentMatch.id]: { ...((old[currentMatch.id] ?? {}) as object), [key]: value } }));
  };
  const advancePractice = () => {
    if (!canAdvancePractice) return;
    if (questionIndex === practiceTotal - 1) { setMcqSubmitted(true); setMatchingSubmitted(true); }
    setQuestionIndex((old) => old + 1);
  };

  return <div className="min-h-screen bg-[#f3f6fb] pb-24 text-slate-800">
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/modules" className="text-sm font-semibold text-[#2A4272] hover:underline">← Quản lý module</Link>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-800">● Demo · Không lưu dữ liệu</span>
      </div>
      <div className="overflow-hidden rounded-[28px] bg-[#192f57] text-white shadow-xl">
        <div className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[44px] border-white/5" />
          <div className="pointer-events-none absolute right-20 top-10 h-40 w-40 rounded-full bg-[#3A8FDB]/20 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.22em] text-sky-200">E-Master / IELTS Speaking Lab</p>
          <div className="relative mt-3 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-4xl">{reeManifest.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-200">{reeManifest.outcome}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1.5">B1 · Speaking Part 1</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">{reeManifest.minutes} phút</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">6 learning stages</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 text-center backdrop-blur">
              <p className="text-3xl font-bold">{completed.length}<span className="text-lg text-slate-300">/6</span></p>
              <p className="mt-1 text-xs text-slate-200">Giai đoạn đã xem</p>
            </div>
          </div>
        </div>
        <div className="h-1.5 bg-white/10"><div className="h-full bg-[#54b9fa] transition-all" style={{ width: `${completed.length / 6 * 100}%` }} /></div>
      </div>
      <nav aria-label="Sáu giai đoạn học thử" className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAGES.map((name, index) => <button key={name} type="button" onClick={() => { setStep(index); setFinished(false); setMessage(''); }}
          aria-current={stage === name ? 'step' : undefined}
          className={`rounded-2xl border px-3 py-4 text-left transition hover:-translate-y-0.5 ${step === index ? 'border-[#3A8FDB] bg-white shadow-md ring-2 ring-sky-100' : 'border-slate-200 bg-white/70'}`}>
          <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step === index ? 'bg-[#2A4272] text-white' : completed.includes(name) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{completed.includes(name) ? '✓' : index + 1}</span>
          <span className="block text-sm font-bold text-[#2A4272]">{name}</span>
          <span className="mt-1 block text-xs text-slate-500">{reeManifest.stageMinutes[name]} phút</span>
        </button>)}
      </nav>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_245px]">
        <main className="min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5 sm:px-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#3A8FDB]">Stage {step + 1} / 6 · {labels[stage]}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#2A4272]">{stage === 'Discover' ? 'Start with your own voice' : stage === 'Learn' ? 'Build a better answer' : stage === 'Practice' ? 'Put REE into practice' : stage === 'Apply' ? 'Speaking Studio' : stage === 'Reflect' ? 'Review your performance' : 'Your final speaking check'}</h2>
          </div>
          <div className="px-5 py-7 sm:px-9 sm:py-9">
            {finished && <div role="status" className="mb-5 rounded-2xl bg-sky-50 p-5 text-sm text-[#2A4272]">✓ Hoàn thành trải nghiệm demo. Chưa có kết quả chấm điểm hoặc nhận xét của coach.</div>}
            {stage === 'Discover' && <section className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#254778] via-[#356ca8] to-[#55a4dd] p-7 text-white sm:p-10">
                <div className="absolute -right-6 -top-8 text-[150px] leading-none opacity-10" aria-hidden="true">“</div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100">Warm-up · IELTS Speaking Part 1</p>
                <p className="relative mt-6 max-w-lg text-2xl font-semibold leading-snug sm:text-3xl">{reeManifest.discoverPrompt}</p>
                <p className="mt-7 text-sm text-sky-100">Speak naturally. There is no right or wrong answer here.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5"><p className="mb-4 text-sm text-slate-600">Ghi âm câu trả lời đầu tiên. Cuối bài học, bạn sẽ được nghe lại để tự so sánh.</p>
                <DemoRecorder id="discover" prompt="Your first take" saved={recordings.discover} onSave={saveRecording} />
              </div>
            </section>}
            {stage === 'Learn' && <section className="space-y-7">
              <div className="overflow-hidden rounded-3xl bg-[#142b4f]">
                <div className="flex aspect-video flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_30%,#315d93,#142b4f_70%)] px-6 text-center text-white">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/10 text-4xl">▶</div>
                  <p className="text-xl font-bold">Respond · Explain · Example</p>
                  <p className="max-w-sm text-sm text-slate-300">Video lesson · Source access not yet verified</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-slate-200">
                  <span>Motion lesson · REE framework</span>
                  {reeManifest.assets.filter((asset) => asset.stage === 'Learn').map((asset) =>
                    <a key={asset.id} href={asset.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-300 underline">Open source video ↗</a>)}
                </div>
              </div>
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Video chưa được xác nhận quyền phát trực tiếp cho học viên. Khung này là thiết kế preview, không phải video đang phát.</p>
              <div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Explore the REE framework</p>
                <div className="grid grid-cols-3 gap-2">{reeManifest.learn.layers.map((layer, i) =>
                  <button key={layer.label} type="button" onClick={() => setLearnTab(i)} aria-pressed={learnTab === i}
                    className={`rounded-xl border px-2 py-4 text-center transition ${learnTab === i ? 'border-[#3A8FDB] bg-sky-50 text-[#2A4272] shadow-sm' : 'border-slate-200 text-slate-500'}`}>
                    <span className="block text-xs font-bold sm:text-base">{i + 1}. {layer.label}</span>
                  </button>)}</div>
                <div className="mt-3 rounded-2xl border border-sky-100 bg-[#f5f9ff] p-6">
                  <h3 className="text-lg font-bold text-[#2A4272]">{reeManifest.learn.layers[learnTab].label}</h3>
                  <p className="mt-2 text-sm leading-relaxed">{reeManifest.learn.layers[learnTab].text}</p>
                  <p className="mt-4 rounded-xl bg-white p-4 text-sm italic text-[#32629b]">{reeManifest.learn.layers[learnTab].language}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Before / After</p>
                <h3 className="mt-2 font-bold text-[#2A4272]">{reeManifest.learn.examples[0].question}</h3>
                <p className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-500">Before: {reeManifest.learn.examples[0].before}</p>
                <div className="mt-3 space-y-2">{reeManifest.learn.examples[0].after.map((line, i) =>
                  <p key={line} className="rounded-xl border-l-4 border-[#3A8FDB] bg-sky-50 px-4 py-3 text-sm leading-relaxed"><strong>{reeManifest.learn.layers[i]?.label}: </strong>{line.replace(/^\[(R|E|Ex)\]\s*/, '')}</p>)}</div>
              </div>
              <button type="button" onClick={() => setShowLearnNotes((old) => !old)} aria-expanded={showLearnNotes}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left text-sm font-semibold text-[#2A4272]">
                <span>Study notes & more examples</span><span>{showLearnNotes ? '−' : '+'}</span>
              </button>
              {showLearnNotes && <div className="space-y-4 rounded-2xl bg-slate-50 p-5 text-sm leading-relaxed">
                {reeManifest.learn.introduction.map((line, i) => <p key={i}>{line}</p>)}
                {reeManifest.learn.respondByQuestion.map((item) => <div key={item.kind}><p className="font-bold">{item.kind}</p><p>{item.method}</p><p className="italic">{item.example}</p></div>)}
                {reeManifest.learn.examples.slice(1).map((item) => <div key={item.label}><p className="font-bold">{item.question}</p><p>Before: {item.before}</p>{item.after.map((line) => <p key={line} className="mt-2 border-l-2 border-sky-300 pl-3">{line}</p>)}</div>)}
              </div>}
              <p className="rounded-2xl bg-[#eff6ff] p-5 text-sm font-medium text-[#2A4272]">{reeManifest.learn.conclusion}</p>
            </section>}
            {stage === 'Practice' && <section className="space-y-6">
              <div className="flex items-center justify-between text-sm"><span className="font-semibold text-[#2A4272]">{practiceDone ? 'Practice complete' : questionIndex < questions.length ? '01 / Multiple choice' : '02 / Matching'}</span>
                <span className="text-slate-500">{Math.min(questionIndex, practiceTotal)} / {practiceTotal} interactions</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#3A8FDB] transition-all" style={{ width: `${Math.min(questionIndex, practiceTotal) / practiceTotal * 100}%` }} /></div>
              {practiceDone ? <div className="rounded-3xl bg-sky-50 p-8 text-center">
                <p className="text-5xl">✓</p><h3 className="mt-4 text-2xl font-bold text-[#2A4272]">Practice complete</h3>
                <p className="mt-3 text-sm text-slate-600">Đã ghi nhận 6 MCQ và 4 matching trong bộ nhớ tạm. Không có khóa đáp án phía client, nên không chấm điểm hay phản hồi đúng/sai giả.</p>
                <button type="button" onClick={() => setQuestionIndex(0)} className="mt-5 text-sm font-semibold text-[#2A4272] underline">Xem lại câu trả lời</button>
              </div> : <div className="space-y-6">
                {currentQuestion && <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Question {questionIndex + 1}</p>
                  <h3 className="mt-3 text-lg font-bold leading-relaxed text-[#2A4272]">{currentQuestion.prompt}</h3>
                  <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-base leading-relaxed">{currentQuestion.studentResponse}</p>
                  <p className="mt-6 text-sm font-semibold">Choose the best expression</p>
                  <div className="mt-3 grid gap-3">{currentQuestion.options.map((option) => <button key={option.id} type="button"
                    onClick={() => chooseMcq('choice', option.id)} aria-pressed={currentMcqAnswer?.choice === option.id}
                    className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left text-sm transition ${currentMcqAnswer?.choice === option.id ? 'border-[#3A8FDB] bg-sky-50 shadow-sm' : 'border-slate-200 hover:border-sky-200'}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold ${currentMcqAnswer?.choice === option.id ? 'bg-[#2A4272] text-white' : 'bg-slate-100 text-slate-500'}`}>{option.id}</span>{option.text}
                  </button>)}</div>
                  <p className="mt-6 text-sm font-semibold">Which REE step is this?</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">{(['Explain', 'Example'] as const).map((option) =>
                    <button key={option} type="button" onClick={() => chooseMcq('stage', option)} aria-pressed={currentMcqAnswer?.stage === option}
                      className={`rounded-2xl border-2 p-4 text-sm font-bold ${currentMcqAnswer?.stage === option ? 'border-[#3A8FDB] bg-sky-50 text-[#2A4272]' : 'border-slate-200'}`}>{option}</button>)}</div>
                </div>}
                {currentMatch && <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Matching set {questionIndex - questions.length + 1}</p>
                  <div className="mt-4 rounded-2xl bg-[#244777] p-6 text-white"><p className="text-xs font-bold uppercase tracking-wider text-sky-200">Respond</p><p className="mt-3 text-lg font-semibold">{currentMatch.text}</p></div>
                  <p className="mt-6 text-sm font-semibold">Select an Explain that supports this answer</p>
                  <div className="mt-3 grid gap-2">{matchingItems.explains.map((item) =>
                    <button key={item.id} type="button" onClick={() => chooseMatch('explain', item.id)} aria-pressed={currentMatchAnswer?.explain === item.id}
                      className={`rounded-xl border-2 p-3 text-left text-sm ${currentMatchAnswer?.explain === item.id ? 'border-[#3A8FDB] bg-sky-50' : 'border-slate-200'}`}><strong className="mr-2">{item.id}</strong>{item.text}</button>)}</div>
                  <p className="mt-6 text-sm font-semibold">Select an Example that supports the explanation</p>
                  <div className="mt-3 grid gap-2">{matchingItems.examples.map((item) =>
                    <button key={item.id} type="button" onClick={() => chooseMatch('example', item.id)} aria-pressed={currentMatchAnswer?.example === item.id}
                      className={`rounded-xl border-2 p-3 text-left text-sm ${currentMatchAnswer?.example === item.id ? 'border-[#3A8FDB] bg-sky-50' : 'border-slate-200'}`}><strong className="mr-2">{item.id}</strong>{item.text}</button>)}</div>
                </div>}
                <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
                  <button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((old) => old - 1)} className="rounded-xl border px-5 py-3 text-sm disabled:opacity-30">← Previous</button>
                  <button type="button" disabled={!canAdvancePractice} onClick={advancePractice}
                    className="rounded-xl bg-[#2A4272] px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{questionIndex === practiceTotal - 1 ? 'Finish practice' : 'Next question →'}</button>
                </div>
              </div>}
            </section>}
            {stage === 'Apply' && <section className="space-y-5"><p className="text-sm">{reeManifest.apply.introduction}</p>
              {reeManifest.apply.prompts.map((prompt) => <DemoRecorder key={prompt.id} id={prompt.id} prompt={prompt.text} saved={recordings[prompt.id]} onSave={saveRecording} />)}
              <div className="rounded-xl bg-slate-50 p-4 text-sm">{reeManifest.apply.reminder.map((line) => <p key={line} className="mt-2">{line}</p>)}</div>
            </section>}
            {stage === 'Reflect' && <section className="space-y-4"><p className="text-sm">{reeManifest.reflect.introduction}</p>
              {reeManifest.apply.prompts.map((prompt) => recordings[prompt.id] && <div key={prompt.id}><p className="text-sm font-semibold">{prompt.text}</p><audio controls src={recordings[prompt.id].url} className="mt-2 w-full" /></div>)}
              {reeManifest.reflect.items.map((item, i) => <label key={item} className="flex gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={reflection[i]} onChange={(e) => setReflection((old) => old.map((v, j) => i === j ? e.target.checked : v))} /><span>{item}</span></label>)}
            </section>}
            {stage === 'Verify' && <section className="space-y-5"><p className="text-sm">{reeManifest.verify.introduction}</p>
              {reeManifest.verify.guidance.map((line) => <p key={line} className="text-sm">{line}</p>)}
              {recordings.discover && <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Discover recording</p><audio controls src={recordings.discover.url} className="mt-2 w-full" /></div>}
              <DemoRecorder id="verify" prompt={reeManifest.verify.prompt} saved={recordings.verify} onSave={saveRecording} />
              <p className="rounded-xl bg-slate-50 p-4 text-sm">Mastery thật: ít nhất 6/8, không tiêu chí 0, Verify 20–30 giây và coach đánh giá. Demo không thực hiện chấm điểm.</p>
            </section>}
            {message && <p role="status" className="mt-4 text-sm text-amber-800">{message}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              {step > 0 && <button type="button" onClick={() => { setStep(step - 1); setFinished(false); }} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">← Back</button>}
              {!finished && <button type="button" disabled={!canContinue} onClick={next} className="rounded-xl bg-[#3A8FDB] px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-40">
                {step === 5 ? 'Finish demo' : 'Continue to next stage →'}</button>}
              <button type="button" onClick={reset} className="ml-auto text-xs font-semibold text-slate-500 underline">Reset demo</button>
            </div>
          </div>
        </main>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Your learning goal</p>
            <h3 className="mt-2 text-lg font-bold text-[#2A4272]">Answer with confidence</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Trả lời 20–30 giây với ba bước Respond, Explain, Example.</p>
            <div className="mt-5 space-y-3">{reeManifest.learn.layers.map((layer, i) => <div key={layer.label} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 font-bold text-[#2A4272]">{i + 1}</span><span>{layer.label}</span>
            </div>)}</div>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-[#eaf4ff] p-5">
            <p className="text-sm font-bold text-[#2A4272]">About this demo</p>
            <p className="mt-2 text-xs leading-relaxed text-[#37577b]">Không lưu tiến độ, câu trả lời hay bản ghi âm lên máy chủ. Refresh sẽ bắt đầu lại. Điểm số và feedback của coach chưa được mô phỏng.</p>
          </div>
        </aside>
      </div>
    </div>
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
