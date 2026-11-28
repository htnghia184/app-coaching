import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticLearners, pilotOutcomes } from '../src/coachingCore/syntheticPilot.ts';
import { prescribeTask, recordAssessment, setPriorities, submitEvidence } from '../src/coachingCore/pilotActions.ts';

test('same target, different priorities and three evidence paths', () => {
  const [a, b] = syntheticLearners;
  assert.equal(a.target, b.target);
  assert.notDeepEqual(a.priorityOutcomes, b.priorityOutcomes);
  assert.deepEqual(new Set([...a.evidence, ...b.evidence].map(item => item.source)),
    new Set(['module_submission', 'task_submission', 'live_session_note']));
  assert.equal(pilotOutcomes.length, 4);
});

test('one direct submission links two versioned LOs and revisions retain source identity', () => {
  const learner = syntheticLearners[0];
  const assignment = learner.assignments.at(-1);
  const first = submitEvidence(learner, { assignmentId: assignment.id, source: assignment.evidenceExpected, summary: 'First response' });
  const revised = submitEvidence(first, { assignmentId: assignment.id, source: assignment.evidenceExpected, summary: 'Revised response' });
  assert.equal(learner.evidence.length + 4, revised.evidence.length);
  assert.match(first.evidence.at(-1).sourceRef, /revision:1$/);
  assert.match(revised.evidence.at(-1).sourceRef, /revision:2$/);
  assert.equal(new Set(first.evidence.slice(-2).map(item => item.sourceRef)).size, 1);
  assert.deepEqual(first.evidence.slice(-2).map(item => item.outcomeId).sort(), ['speaking-example','speaking-ree']);
  assert.throws(() => submitEvidence(learner, { assignmentId: assignment.id, source: 'live_session_note', summary: 'Wrong path' }));
});

test('assessment remains separate from module completion and reassessment preserves history', () => {
  const original = syntheticLearners[0];
  assert.equal(original.assessments[0].status, 'developing');
  const revised = recordAssessment(original, {
    outcomeId: 'speaking-ree', outcomeVersion: 1, status: 'demonstrated', evidenceIds: ['e-a1'],
    rationale: 'Coach reassessed the linked response.', feedback: 'Keep the ideas connected.', minutes: 12,
  });
  assert.equal(original.assessments.length, 1);
  assert.equal(revised.assessments.length, 2);
  assert.equal(revised.assessments[0].status, 'developing');
  assert.equal(revised.assessments[1].status, 'demonstrated');
  assert.deepEqual(revised.assessments[1].evidenceIds, ['e-a1']);
  assert.equal(revised.coachMinutesThisWeek, original.coachMinutesThisWeek + 12);
  assert.throws(() => recordAssessment(original, {
    outcomeId: 'speaking-example', outcomeVersion: 1, status: 'demonstrated', evidenceIds: ['e-a1'],
    rationale: 'Wrong evidence.', feedback: 'Not valid.', minutes: 4,
  }));
});

test('one immutable direct submission supports distinct LO assessments', () => {
  const submitted = submitEvidence(syntheticLearners[0], { assignmentId: 'a2', source: 'task_submission', summary: 'One answer with linked explanation and example' });
  const [ree, example] = submitted.evidence.slice(-2);
  const first = recordAssessment(submitted, { outcomeId: ree.outcomeId, outcomeVersion: ree.outcomeVersion, status: 'developing', evidenceIds: [ree.id], rationale: 'Link needs work', feedback: 'Connect the detail', minutes: 4 });
  const second = recordAssessment(first, { outcomeId: example.outcomeId, outcomeVersion: example.outcomeVersion, status: 'demonstrated', evidenceIds: [example.id], rationale: 'Specific example observed', feedback: 'Keep that detail', minutes: 5 });
  assert.equal(ree.sourceRef, example.sourceRef);
  assert.deepEqual(second.assessments.slice(-2).map(item => item.status), ['developing','demonstrated']);
  assert.equal(submitted.assessments.length + 2, second.assessments.length);
});

test('next task requires a selected LO and keeps the learner-specific rationale', () => {
  const learner = setPriorities(syntheticLearners[1], [{ id: 'speaking-opening', version: 1 }]);
  assert.throws(() => prescribeTask(learner, {
    outcomes: [{ id: 'speaking-example', version: 1 }], title: 'Try examples', reason: 'For practice',
    moduleId: null, moduleVersion: null, evidenceExpected: 'task_submission', due: '2026-12-05',
  }, 3));
  const next = prescribeTask(learner, {
    outcomes: [{ id: 'speaking-opening', version: 1 }], title: 'Record a new answer', reason: 'Avoid repeating the prompt',
    moduleId: null, moduleVersion: null, evidenceExpected: 'task_submission', due: '2026-12-05',
  }, 9);
  assert.equal(next.assignments.at(-1).reason, 'Avoid repeating the prompt');
  assert.equal(next.assignments.at(-1).moduleId, null);
  assert.equal(next.coachMinutesThisWeek, learner.coachMinutesThisWeek + 9);
  const adminTask = prescribeTask(learner, { outcomes: [], title: 'Confirm appointment', reason: 'Arrange next coaching session', moduleId: null, moduleVersion: null, evidenceExpected: 'task_submission', due: '2026-12-05' }, 2);
  assert.equal(adminTask.assignments.at(-1).outcomes.length, 0);
});
