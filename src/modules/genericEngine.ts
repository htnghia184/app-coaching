import Ajv2020 from 'ajv/dist/2020.js';

export type ActivityType = 'lesson' | 'media' | 'choice' | 'matching' | 'text_response' | 'recording' | 'reflection' | 'evidence_submit';
export type PublicActivity = { id: string; type: ActivityType; title: string; instructions: string; payload: Record<string, unknown> };
export type PublicModule = {
  schemaVersion: 1; moduleId: string; contentVersion: number; title: string; outcomeStatement: string; level: string; skill: string;
  estimatedMinutes: number; sourceRevisionRef: string; outcomeIds: string[];
  stages: { id: string; title: string; activities: PublicActivity[] }[];
  verifyPolicy: { kind: 'rubric_sum'; criteria: string[]; minTotal: number; noZero: true; freshRecording: true }
    | { kind: 'per_item_pass'; itemIds: string[]; minPass: number; noQuestionRepeat: true; reuseApply: true };
};

const str = { type: 'string', minLength: 1 };
const strArray = { type: 'array', items: str, uniqueItems: true };
const activity = (type: ActivityType, payload: object) => ({
  type: 'object', additionalProperties: false,
  required: ['id', 'type', 'title', 'instructions', 'payload'],
  properties: { id: str, type: { const: type }, title: str, instructions: str, payload },
});
const payload = (properties: object, required: string[]) => ({ type: 'object', additionalProperties: false, required, properties });
const item = { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: str, text: str } };

export const publicModuleSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'moduleId', 'contentVersion', 'title', 'outcomeStatement', 'level', 'skill', 'estimatedMinutes', 'sourceRevisionRef', 'outcomeIds', 'stages', 'verifyPolicy'],
  properties: {
    schemaVersion: { const: 1 }, moduleId: str, contentVersion: { type: 'integer', minimum: 1 },
    title: str, outcomeStatement: str, level: str, skill: str, estimatedMinutes: { type: 'integer', minimum: 1 },
    sourceRevisionRef: str, outcomeIds: { ...strArray, minItems: 1 },
    stages: { type: 'array', minItems: 1, items: {
      type: 'object', additionalProperties: false, required: ['id', 'title', 'activities'],
      properties: { id: str, title: str, activities: { type: 'array', items: { oneOf: [
        activity('lesson', payload({ blocks: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id','kind','text'], properties: { id: str, kind: { enum: ['paragraph','comparison','table','transcript','callout','example'] }, text: str } } } }, ['blocks'])),
        activity('media', payload({ kind: { enum: ['youtube','audio'] }, assetRef: str, transcript: { type: 'string' } }, ['kind','assetRef'])),
        activity('choice', payload({ items: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id','prompt','fields'], properties: { id: str, prompt: str, fields: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id','mode','options'], properties: { id: str, mode: { enum: ['single','multi'] }, options: { type: 'array', minItems: 2, items: item } } } } } } } }, ['items'])),
        activity('matching', payload({ prompts: { type: 'array', minItems: 1, items: item }, groups: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id','options'], properties: { id: str, options: { type: 'array', minItems: 2, items: item } } } } }, ['prompts','groups'])),
        activity('text_response', payload({ fields: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id','prompt','mode'], properties: { id: str, prompt: str, mode: { enum: ['constrained_blank','open_response'] } } } } }, ['fields'])),
        activity('recording', payload({ prompts: { type: 'array', minItems: 1, items: item }, targetSeconds: { type: 'integer', minimum: 1 } }, ['prompts'])),
        activity('reflection', payload({ items: { type: 'array', minItems: 1, items: item }, scored: { const: false } }, ['items','scored'])),
        activity('evidence_submit', payload({ evidenceItemIds: { ...strArray, minItems: 1 }, reflectionRequired: { type: 'boolean' } }, ['evidenceItemIds','reflectionRequired'])),
      ] } } },
    } },
    verifyPolicy: { oneOf: [
      { type: 'object', additionalProperties: false, required: ['kind','criteria','minTotal','noZero','freshRecording'], properties: { kind: { const: 'rubric_sum' }, criteria: { ...strArray, minItems: 4, maxItems: 4 }, minTotal: { const: 6 }, noZero: { const: true }, freshRecording: { const: true } } },
      { type: 'object', additionalProperties: false, required: ['kind','itemIds','minPass','noQuestionRepeat','reuseApply'], properties: { kind: { const: 'per_item_pass' }, itemIds: { ...strArray, minItems: 6, maxItems: 6 }, minPass: { const: 5 }, noQuestionRepeat: { const: true }, reuseApply: { const: true } } },
    ] },
  },
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(publicModuleSchema);

export function parsePublicModule(value: unknown): PublicModule {
  if (!validate(value)) throw new Error(ajv.errorsText(validate.errors));
  const module = value as PublicModule;
  const ids = module.stages.flatMap(stage => [stage.id, ...stage.activities.map(activity => activity.id)]);
  if (new Set(ids).size !== ids.length) throw new Error('Stage and activity IDs must be unique');
  const checkSiblingIds = (node: unknown): void => {
    if (Array.isArray(node)) {
      const siblingIds = node.filter((item): item is { id: string } => Boolean(item && typeof item === 'object' && typeof item.id === 'string')).map(item => item.id);
      if (new Set(siblingIds).size !== siblingIds.length) throw new Error('Sibling item IDs must be unique');
      node.forEach(checkSiblingIds);
    } else if (node && typeof node === 'object') Object.values(node).forEach(checkSiblingIds);
  };
  checkSiblingIds(value);
  const serialized = JSON.stringify(value);
  if (/"(?:correct|answerKey|privateKey|rubricAnchors)"\s*:/.test(serialized) || /<script|javascript:/i.test(serialized)) {
    throw new Error('Private keys or active content are forbidden in public manifests');
  }
  const recordingIds = new Set(module.stages.flatMap(stage => stage.activities.filter(a => a.type === 'recording').flatMap(a => (a.payload.prompts as {id:string}[]).map(p => p.id))));
  for (const stage of module.stages) for (const activity of stage.activities) {
    if (activity.type === 'evidence_submit' && !(activity.payload.evidenceItemIds as string[]).every(id => recordingIds.has(id))) {
      throw new Error('Evidence references must resolve to recording prompts');
    }
  }
  const promptsIn = (stageId: string) => new Set(module.stages.filter(s => s.id === stageId)
    .flatMap(s => s.activities.filter(a => a.type === 'recording'))
    .flatMap(a => (a.payload.prompts as { id: string }[]).map(p => p.id)));
  if (module.verifyPolicy.kind === 'per_item_pass') {
    const applyPrompts = promptsIn('Apply');
    if (module.verifyPolicy.itemIds.some(id => !applyPrompts.has(id)) || promptsIn('Verify').size > 0) {
      throw new Error('Per-item Verify must reuse Apply recordings without a fresh Verify recording');
    }
  } else if (promptsIn('Verify').size === 0) {
    throw new Error('Rubric Verify requires a fresh recording prompt');
  }
  return module;
}

export function evaluateVerify(policy: PublicModule['verifyPolicy'], review: { scores?: number[]; reviewedItems?: string[]; passedItems?: string[]; repeatedItems?: string[]; freshRecording?: boolean }): boolean {
  if (policy.kind === 'rubric_sum') {
    return review.freshRecording === true && review.scores?.length === 4
      && review.scores.every(score => Number.isInteger(score) && score >= 0 && score <= 2)
      && review.scores.every(score => score > 0) && review.scores.reduce((a,b) => a+b, 0) >= policy.minTotal;
  }
  return policy.itemIds.every(id => review.reviewedItems?.includes(id))
    && (review.passedItems?.filter(id => policy.itemIds.includes(id)).length ?? 0) >= policy.minPass
    && !(review.repeatedItems?.some(id => policy.itemIds.includes(id)));
}
