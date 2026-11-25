import type { ActivityAttempt } from './moduleService';
import type { ChoiceQuestion } from './ree';

type Item = { id: string; text: string };
export type InteractionDefinition =
  | { type: 'multiple_choice'; id: string; questions: ChoiceQuestion[] }
  | { type: 'matching'; id: string; responds: Item[]; explains: Item[]; examples: Item[] }
  | { type: 'fill_blank'; id: string; prompts: Item[] }
  | { type: 'text_response'; id: string; prompts: Item[] };

export function InteractionRegistry({ definition, response, onChange, result, disabled }: {
  definition: InteractionDefinition;
  response: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  result?: ActivityAttempt['result'];
  disabled: boolean;
}) {
  const update = (id: string, value: unknown) => onChange({ ...response, [id]: value });
  if (definition.type === 'multiple_choice') return (
    <div className="mt-4 space-y-4">{definition.questions.map((question) => {
      const selection = (response[question.id] ?? {}) as { choice?: string; stage?: string };
      return <fieldset key={question.id} className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-master">Câu {question.id}</legend>
        <p className="text-sm">{question.prompt}</p>
        <p className="mt-1 text-sm">{question.studentResponse}</p>
        <div className="mt-3 space-y-2">{question.options.map((option) => (
          <label key={option.id} className="flex gap-2 text-sm">
            <input type="radio" name={`${definition.id}-${question.id}`} value={option.id}
              disabled={disabled} checked={selection.choice === option.id}
              onChange={() => update(question.id, { ...selection, choice: option.id })} />
            <span>{option.id}. {option.text}</span>
          </label>
        ))}</div>
        <label className="mt-3 block text-sm">Bước REE:
          <select disabled={disabled} value={selection.stage ?? ''}
            onChange={(event) => update(question.id, { ...selection, stage: event.target.value })}
            className="ml-2 rounded-lg border border-slate-300 p-2">
            <option value="">Chọn bước</option><option value="Explain">Explain</option><option value="Example">Example</option>
          </select>
        </label>
        {result?.[question.id] && <InteractionFeedback result={result[question.id]} />}
      </fieldset>;
    })}</div>
  );
  if (definition.type === 'matching') return <>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <OptionList title="Explain" items={definition.explains} />
      <OptionList title="Example" items={definition.examples} />
    </div>
    <div className="mt-4 space-y-3">{definition.responds.map((item) => {
      const selection = (response[item.id] ?? {}) as { explain?: string; example?: string };
      return <div key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm">
        <p className="font-medium text-master">{item.id}. {item.text}</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <label>Explain <select disabled={disabled} value={selection.explain ?? ''}
            onChange={(event) => update(item.id, { ...selection, explain: event.target.value })}
            className="ml-2 rounded-lg border border-slate-300 p-2">
            <option value="">Chọn</option>{definition.explains.map((choice) => <option key={choice.id}>{choice.id}</option>)}
          </select></label>
          <label>Example <select disabled={disabled} value={selection.example ?? ''}
            onChange={(event) => update(item.id, { ...selection, example: event.target.value })}
            className="ml-2 rounded-lg border border-slate-300 p-2">
            <option value="">Chọn</option>{definition.examples.map((choice) => <option key={choice.id}>{choice.id}</option>)}
          </select></label>
        </div>
        {result?.[item.id] && <InteractionFeedback result={result[item.id]} />}
      </div>;
    })}</div>
  </>;
  if (definition.type === 'fill_blank') return (
    <div className="mt-4 space-y-3">{definition.prompts.map((item) => <label key={item.id}
      className="block rounded-xl border border-slate-200 p-4 text-sm">
      {item.text}
      <input type="text" disabled={disabled} value={String(response[item.id] ?? '')}
        onChange={(event) => update(item.id, event.target.value)}
        className="mt-2 block w-full rounded-lg border border-slate-300 p-2" />
      {result?.[item.id] && <InteractionFeedback result={result[item.id]} />}
    </label>)}</div>
  );
  return (
    <div className="mt-4 space-y-3">{definition.prompts.map((item) => <label key={item.id}
      className="block rounded-xl border border-slate-200 p-4 text-sm">
      {item.text}
      <textarea disabled={disabled} value={String(response[item.id] ?? '')}
        onChange={(event) => update(item.id, event.target.value)} rows={4}
        className="mt-2 block w-full rounded-lg border border-slate-300 p-2" />
      {result?.[item.id] && <InteractionFeedback result={result[item.id]} />}
    </label>)}</div>
  );
}

function OptionList({ title, items }: { title: string; items: Item[] }) {
  return <div className="rounded-xl bg-slate-50 p-4 text-sm">
    <h4 className="font-semibold text-master">{title}</h4>
    {items.map((item) => <p key={item.id} className="mt-2">{item.id}. {item.text}</p>)}
  </div>;
}

function InteractionFeedback({ result }: { result: { correct: boolean; answer: unknown; explanation: string } }) {
  const answer = typeof result.answer === 'object' && result.answer !== null
    ? Object.values(result.answer as Record<string,string>).join(' – ') : String(result.answer);
  return <div className={`mt-3 rounded-lg p-3 text-sm ${result.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>
    <p className="font-semibold">{result.correct ? 'Đúng' : 'Chưa đúng'} · Đáp án: {answer}</p>
    <p className="mt-1">{result.explanation}</p>
  </div>;
}
