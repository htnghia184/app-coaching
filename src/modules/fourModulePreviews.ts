import { parsePublicModule, type PublicActivity, type PublicModule } from './genericEngine.ts';
import { pilotOutcomes } from '../coachingCore/syntheticPilot.ts';

// Structural previews only. The SharePoint packages remain the source of teaching wording,
// options, explanations, rubrics and media. These prompts deliberately contain no source exercises.
const placeholder = 'Source-approved teaching content is pending private import and academic parity review.';
const item = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i + 1}`, text: `Private source item ${i + 1} pending import` }));
const base = (id: string, type: PublicActivity['type'], title: string, payload: Record<string, unknown>): PublicActivity =>
  ({ id, type, title, instructions: placeholder, payload });
const recording = (stage: string, n: number) => base(`${stage}-record`, 'recording', 'Record and review', { prompts: item(`${stage}-audio`, n), targetSeconds: 30 });
const choice = (id: string, n: number) => base(id, 'choice', 'Choice practice', { items: Array.from({ length: n }, (_, i) => ({
  id: `${id}-${i + 1}`, prompt: placeholder, fields: [{ id: 'selection', mode: 'single', options: item(`${id}-option-${i + 1}`, 3) }],
})) });
const matching = (n: number) => base('practice-matching', 'matching', 'Matching practice',
  { prompts: item('match-prompt', n), groups: [{ id: 'explain', options: item('explain', n) }, { id: 'example', options: item('example', n) }] });
const text = (id: string, n: number, mode: 'constrained_blank' | 'open_response') => base(id, 'text_response', 'Written practice',
  { fields: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i + 1}`, prompt: placeholder, mode })) });
const reflect = (n: number) => base('reflect-check', 'reflection', 'Self-check', { items: item('criterion', n), scored: false });
const lesson = () => base('learn-lesson', 'lesson', 'Learning material', { blocks: [{ id: 'source-pending', kind: 'paragraph', text: placeholder }] });
const media = (code: string) => base('learn-media', 'media', 'Source media', { kind: 'youtube', assetRef: `private:${code}:video`, transcript: '' });
const stage = (id: string, activities: PublicActivity[]) => ({ id, title: id, activities });
const policy = (code: string, applyCount: number): PublicModule['verifyPolicy'] => code === 'm02'
  ? { kind: 'per_item_pass', itemIds: item('apply-audio', applyCount).map(x => x.id), minPass: 5, noQuestionRepeat: true, reuseApply: true }
  : { kind: 'rubric_sum', criteria: code === 'm04' ? ['Who','What','When','Relevance'] : code === 'm03' ? ['Respond','New detail','Specific detail','Relevance'] : ['Respond','Explain','Example','Relevance'], minTotal: 6, noZero: true, freshRecording: true };

function build(code: string, title: string, outcome: string, minutes: number, discoverAudio: number,
  practice: PublicActivity[], applyAudio: number, reflectCount: number): PublicModule {
  // Synthetic many-to-many contract fixture only; no academic package mapping.
  const fixtureLinks: Record<string, string[]> = { m01: ['speaking-ree','speaking-example'], m02: ['speaking-opening'], m03: ['speaking-ree','speaking-self-question'], m04: ['speaking-example'] };
  const applyIds = item('apply-audio', applyAudio).map(x => x.id);
  const draft = {
    schemaVersion: 2, moduleId: `ielts-speaking-${code}`, contentVersion: 1, title, outcomeStatement: outcome, level: 'B1',
    skill: 'Speaking', estimatedMinutes: minutes, sourceRevisionRef: `sharepoint-${code}-2026-11`,
    outcomes: fixtureLinks[code].map(id => { const lo = pilotOutcomes.find(item => item.id === id)!; return { id: lo.id, version: lo.version, statement: lo.statement }; }),
    stages: [
      stage('Discover', discoverAudio ? [recording('discover', discoverAudio)] : [choice('discover-compare', 1)]),
      stage('Learn', [lesson(), media(code)]),
      stage('Practice', practice),
      stage('Apply', [recording('apply', applyAudio)]),
      stage('Reflect', [reflect(reflectCount)]),
      stage('Verify', code === 'm02'
        ? [base('verify-submit', 'evidence_submit', 'Submit six Apply recordings', { evidenceItemIds: applyIds, reflectionRequired: true })]
        : [recording('verify', 1), base('verify-submit', 'evidence_submit', 'Submit fresh Verify recording', { evidenceItemIds: ['verify-audio-1'], reflectionRequired: true })]),
    ],
    verifyPolicy: policy(code, applyAudio),
  };
  return parsePublicModule(draft);
}

export const fourModulePreviews: PublicModule[] = [
  build('m01', 'Simple Answer Development (Part 1)', 'Respond → Explain → Example (REE)', 21, 1,
    [choice('practice-choice', 6), matching(4)], 3, 5),
  build('m02', 'Mở đầu tự nhiên (Part 1)', 'A natural opening suited to six question types', 24, 1,
    [choice('practice-classification', 6), choice('practice-mcq', 6), text('practice-blanks', 4, 'constrained_blank')], 6, 6),
  build('m03', 'Self-Questioning (Part 1)', 'Direct response plus relevant self-questions', 24, 1,
    [choice('practice-choice', 6), text('practice-completions', 3, 'open_response'), text('practice-prompts', 3, 'open_response')], 3, 5),
  build('m04', 'Example (Part 1)', 'A specific example with WHO, WHAT AND WHEN', 25, 0,
    [choice('practice-choice', 6), text('practice-rewrites', 4, 'open_response')], 6, 6),
];
