import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticLearners, pilotOutcomes } from '../src/coachingCore/syntheticPilot.ts';
import { prescribeTask, recordAssessment, setPriorities, submitEvidence } from '../src/coachingCore/pilotActions.ts';

test('same target, different priorities and three evidence paths', () => {
  const [a, b] = syntheticLearners;
  assert.equal(a.target, b.target);
  assert.notDeepEqual(a.priorityOutcomeIds, b.priorityOutcomeIds);
  assert.deepEqual(new Set([...a.evidence, ...b.evidence].map(item => item.source)),
    new Set(['module_submission', 'task_submission', 'live_session_note']));
  assert.equal(pilotOutcomes.length, 4);
});

test('learner submission and revision create independent versioned evidence', () => {
  const learner = syntheticLearners[0];
  const assignment = learner.assignments.at(-1);
  const first = submitEvidence(learner, { assignmentId: assignment.id, source: assignment.evidenceExpected, summary: 'First response' });
  const revised = submitEvidence(first, { assignmentId: assignment.id, source: assignment.evidenceExpected, summary: 'Revised response' });
  assert.equal(learner.evidence.length + 2, revised.evidence.length);
  assert.match(first.evidence.at(-1).sourceRef, /revision:1$/);
  assert.match(revised.evidence.at(-1).sourceRef, /revision:2$/);
  assert.throws(() => submitEvidence(learner, { assignmentId: assignment.id, source: 'live_session_note', summary: 'Wrong path' }));
});

test('assessment remains separate from module completion and reassessment preserves history', () => {
  const original = syntheticLearners[0];
  assert.equal(original.assessments[0].status, 'developing');
  const revised = recordAssessment(original, {
    outcomeId: 'speaking-ree', status: 'demonstrated', evidenceIds: ['e-a1'],
    rationale: 'Coach reassessed the linked response.', feedback: 'Keep the ideas connected.', minutes: 12,
  });
  assert.equal(original.assessments.length, 1);
  assert.equal(revised.assessments.length, 2);
  assert.equal(revised.assessments[0].status, 'developing');
  assert.equal(revised.assessments[1].status, 'demonstrated');
  assert.deepEqual(revised.assessments[1].evidenceIds, ['e-a1']);
  assert.equal(revised.coachMinutesThisWeek, original.coachMinutesThisWeek + 12);
  assert.throws(() => recordAssessment(original, {
    outcomeId: 'speaking-example', status: 'demonstrated', evidenceIds: ['e-a1'],
    rationale: 'Wrong evidence.', feedback: 'Not valid.', minutes: 4,
  }));
});

test('next task requires a selected LO and keeps the learner-specific rationale', () => {
  const learner = setPriorities(syntheticLearners[1], ['speaking-opening']);
  assert.throws(() => prescribeTask(learner, {
    outcomeId: 'speaking-example', title: 'Try examples', reason: 'For practice',
    moduleId: null, moduleVersion: null, evidenceExpected: 'task_submission', due: '2026-12-05',
  }, 3));
  const next = prescribeTask(learner, {
    outcomeId: 'speaking-opening', title: 'Record a new answer', reason: 'Avoid repeating the prompt',
    moduleId: null, moduleVersion: null, evidenceExpected: 'task_submission', due: '2026-12-05',
  }, 9);
  assert.equal(next.assignments.at(-1).reason, 'Avoid repeating the prompt');
  assert.equal(next.assignments.at(-1).moduleId, null);
  assert.equal(next.coachMinutesThisWeek, learner.coachMinutesThisWeek + 9);
});
