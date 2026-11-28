import type { LearningOutcome, PilotLearner } from './pilotContract';

// Synthetic examples only. IDs do not map to production records or private source assets.
export const pilotOutcomes: LearningOutcome[] = [
  { id: 'speaking-ree', version: 1, statement: 'Develop a connected Part 1 answer using Respond, Explain and Example.', successCriteria: 'A relevant 20–30 second response with a clear link between ideas.' },
  { id: 'speaking-opening', version: 1, statement: 'Use a natural opening appropriate to the question type.', successCriteria: 'An opening suited to the prompt without repeating the whole question.' },
  { id: 'speaking-self-question', version: 1, statement: 'Extend a direct answer with relevant self-questions.', successCriteria: 'One or two self-questions add a relevant new detail.' },
  { id: 'speaking-example', version: 1, statement: 'Support a response with a specific example.', successCriteria: 'A relevant one or two sentence example states WHO, WHAT AND WHEN.' },
];

export const syntheticLearners: PilotLearner[] = [
  {
    id: 'learner-a', name: 'Minh Anh', target: 'IELTS Speaking 6.5', priorityOutcomes: [{ id: 'speaking-ree', version: 1 }, { id: 'speaking-example', version: 1 }], coachMinutesThisWeek: 42,
    assignments: [
      { id: 'a1', learnerId: 'learner-a', outcomes: [{ id: 'speaking-ree', version: 1 }], title: 'REE guided module and fresh answer', reason: 'Diagnostic answer was brief and ideas were disconnected.', moduleId: 'ielts-speaking-m01', moduleVersion: 1, evidenceExpected: 'module_submission', due: '2026-12-01' },
      { id: 'a2', learnerId: 'learner-a', outcomes: [{ id: 'speaking-ree', version: 1 }, { id: 'speaking-example', version: 1 }], title: 'Record a concrete personal example', reason: 'Coach wants a specific example after the REE practice.', moduleId: null, moduleVersion: null, evidenceExpected: 'task_submission', due: '2026-12-03' },
    ],
    evidence: [
      { id: 'e-a1', learnerId: 'learner-a', outcomeId: 'speaking-ree', outcomeVersion: 1, source: 'module_submission', sourceRef: 'synthetic-revision-a1', summary: 'Completed practice; Verify answer still needs a clearer link.', capturedAt: '2026-11-26' },
      { id: 'e-a2', learnerId: 'learner-a', outcomeId: 'speaking-example', outcomeVersion: 1, source: 'task_submission', sourceRef: 'synthetic-task-a2', summary: 'Audio response names a place but gives no event.', capturedAt: '2026-11-27' },
    ],
    assessments: [
      { id: 'as-a1', learnerId: 'learner-a', outcomeId: 'speaking-ree', outcomeVersion: 1, status: 'developing', evidenceIds: ['e-a1'], rationale: 'Module is complete, but the observed answer does not yet meet the linkage criterion.', assessedAt: '2026-11-27', coachId: 'synthetic-coach' },
    ],
  },
  {
    id: 'learner-b', name: 'Quang Huy', target: 'IELTS Speaking 6.5', priorityOutcomes: [{ id: 'speaking-opening', version: 1 }, { id: 'speaking-self-question', version: 1 }], coachMinutesThisWeek: 28,
    assignments: [
      { id: 'b1', learnerId: 'learner-b', outcomes: [{ id: 'speaking-opening', version: 1 }], title: 'Apply six natural openings', reason: 'Diagnostic answers repeated each question verbatim.', moduleId: 'ielts-speaking-m02', moduleVersion: 1, evidenceExpected: 'module_submission', due: '2026-12-02' },
      { id: 'b2', learnerId: 'learner-b', outcomes: [{ id: 'speaking-self-question', version: 1 }], title: 'Live coaching: expand a direct answer', reason: 'Coach can prompt and observe spontaneous detail in session.', moduleId: null, moduleVersion: null, evidenceExpected: 'live_session_note', due: '2026-12-04' },
    ],
    evidence: [
      { id: 'e-b1', learnerId: 'learner-b', outcomeId: 'speaking-self-question', outcomeVersion: 1, source: 'live_session_note', sourceRef: 'synthetic-session-b1', summary: 'Coach observed two relevant self-questions in a live conversation.', capturedAt: '2026-11-27' },
    ],
    assessments: [
      { id: 'as-b1', learnerId: 'learner-b', outcomeId: 'speaking-self-question', outcomeVersion: 1, status: 'demonstrated', evidenceIds: ['e-b1'], rationale: 'Observed independently in a new prompt; recheck next week.', assessedAt: '2026-11-27', coachId: 'synthetic-coach' },
    ],
  },
];
