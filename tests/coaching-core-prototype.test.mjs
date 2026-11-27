import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticLearners, pilotOutcomes } from '../src/coachingCore/syntheticPilot.ts';
import { prescribeTask, recordAssessment, setPriorities } from '../src/coachingCore/pilotActions.ts';

test('same target, different priorities and three evidence paths', () => {
  const [a, b] = syntheticLearners;
  assert.equal(a.target, b.target);
  assert.notDeepEqual(a.priorityOutcomeIds, b.priorityOutcomeIds);
  assert.deepEqual(new Set([...a.evidence, ...b.evidence].map(item => item.source)),
    new Set(['module_attempt', 'task_submission', 'live_session_note']));
  assert.equal(pilotOutcomes.length, 4);
});

test('assessment remains separate from module completion and reassessment preserves history', () => {
  const original = syntheticLearners[0];
  assert.equal(original.assessments[0].status, 'developing');
  const revised = recordAssessment(original, {
    outcomeId: 'speaking-ree', status: 'demonstrated', evidenceIds: ['e-a1'],
    rationale: 'Coach reassessed the linked response.', feedback: 'Keep the ideas connected.',
  });
  assert.equal(original.assessments.length, 1);
  assert.equal(revised.assessments.length, 2);
  assert.equal(revised.assessments[0].status, 'developing');
  assert.equal(revised.assessments[1].status, 'demonstrated');
  assert.deepEqual(revised.assessments[1].evidenceIds, ['e-a1']);
  assert.throws(() => recordAssessment(original, {
    outcomeId: 'speaking-example', status: 'demonstrated', evidenceIds: ['e-a1'],
    rationale: 'Wrong evidence.', feedback: 'Not valid.',
  }));
});

test('next task requires a selected LO and keeps the learner-specific rationale', () => {
  const learner = setPriorities(syntheticLearners[1], ['speaking-opening']);
  assert.throws(() => prescribeTask(learner, {
    outcomeId: 'speaking-example', title: 'Try examples', reason: 'For practice',
    moduleId: null, evidenceExpected: 'task_submission', due: '2026-12-05',
  }));
  const next = prescribeTask(learner, {
    outcomeId: 'speaking-opening', title: 'Record a new answer', reason: 'Avoid repeating the prompt',
    moduleId: null, evidenceExpected: 'task_submission', due: '2026-12-05',
  });
  assert.equal(next.assignments.at(-1).reason, 'Avoid repeating the prompt');
  assert.equal(next.assignments.at(-1).moduleId, null);
});
