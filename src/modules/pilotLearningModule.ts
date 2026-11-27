import { reeManifest } from './ree';
import type { LearningModule } from './learningSchema';

/** Compatibility adapter: REE is content, not the definition of the player. */
export const pilotLearningModule: LearningModule = {
  id: reeManifest.id,
  version: reeManifest.version,
  title: reeManifest.title,
  level: reeManifest.level,
  skill: reeManifest.skill,
  minutes: reeManifest.minutes,
  outcome: reeManifest.outcome,
  stages: [
    { id: 'discover', title: 'Discover', minutes: reeManifest.stageMinutes.Discover, activities: [
      { id: 'discover-audio', type: 'recording', title: 'Warm-up', prompts: [{ id: 'discover-prompt', text: reeManifest.discoverPrompt }] },
    ] },
    { id: 'learn', title: 'Learn', minutes: reeManifest.stageMinutes.Learn, activities: [
      ...reeManifest.assets.filter(asset => asset.stage === 'Learn' && asset.kind === 'video').map(asset => ({
        id: asset.id, type: 'video' as const, title: 'Video lesson', url: asset.url, verified: asset.verified,
      })),
      { id: 'learn-steps', type: 'lesson', title: 'Learning framework',
        sections: reeManifest.learn.layers.map(layer => ({ title: layer.label, body: layer.text, example: layer.language })) },
    ] },
    { id: 'practice', title: 'Practice', minutes: reeManifest.stageMinutes.Practice, activities: [
      { id: 'practice-mcq', type: 'multiple_choice', title: reeManifest.practice.mcq.title,
        questions: reeManifest.practice.mcq.questions.map(question => ({
          id: question.id, prompt: `${question.prompt} — ${question.studentResponse}`, options: question.options,
        })) },
      { id: 'practice-matching-explain', type: 'matching', title: 'Match explanations',
        prompts: reeManifest.practice.matching.responds, options: reeManifest.practice.matching.explains },
      { id: 'practice-matching-example', type: 'matching', title: 'Match examples',
        prompts: reeManifest.practice.matching.responds.map(item => ({ ...item, id: `example-${item.id}` })),
        options: reeManifest.practice.matching.examples },
    ] },
    { id: 'apply', title: 'Apply', minutes: reeManifest.stageMinutes.Apply, activities: [
      { id: 'apply-audio', type: 'recording', title: 'Speaking practice', prompts: reeManifest.apply.prompts },
    ] },
    { id: 'reflect', title: 'Reflect', minutes: reeManifest.stageMinutes.Reflect, activities: [
      { id: 'reflect-checklist', type: 'reflection', title: 'Self-review', items: reeManifest.reflect.items },
    ] },
    { id: 'verify', title: 'Verify', minutes: reeManifest.stageMinutes.Verify, activities: [
      { id: 'verify-audio', type: 'recording', title: 'Final response', prompts: [{ id: 'verify-prompt', text: reeManifest.verify.prompt }] },
    ] },
  ],
};
