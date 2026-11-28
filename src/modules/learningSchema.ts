/** Generic presentation contract. No IELTS technique, stage count or assessment key is required. */
export type LearningActivity =
  | { id: string; type: 'video'; title: string; url: string; verified: boolean }
  | { id: string; type: 'lesson'; title: string; sections: { title: string; body: string; example?: string }[] }
  | { id: string; type: 'multiple_choice'; title: string; questions: { id: string; prompt: string; options: { id: string; text: string }[] }[] }
  | { id: string; type: 'matching'; title: string; prompts: { id: string; text: string }[]; options: { id: string; text: string }[] }
  | { id: string; type: 'recording'; title: string; prompts: { id: string; text: string }[] }
  | { id: string; type: 'reflection'; title: string; items: string[] };

export interface LearningModule {
  id: string;
  version: number;
  title: string;
  level: string;
  skill: string;
  minutes: number;
  outcome: string;
  stages: { id: string; title: string; minutes?: number; activities: LearningActivity[] }[];
}

export function validateLearningModule(value: LearningModule): string[] {
  const errors: string[] = [];
  if (!value.id || !value.title || value.version < 1) errors.push('Module identity is missing');
  if (!value.stages.length) errors.push('At least one stage is required');
  const ids = value.stages.flatMap(stage => [stage.id, ...stage.activities.map(activity => activity.id)]);
  if (new Set(ids).size !== ids.length) errors.push('Stage and activity IDs must be unique');
  if (value.stages.some(stage => !stage.id || !stage.title)) errors.push('Stage metadata is missing');
  if (JSON.stringify(value).match(/"correct"\s*:|"answerKey"\s*:/)) errors.push('Do not expose private answer keys');
  return errors;
}
