import type { CoachAssessment, OutcomeStatus, PersonalizedAssignment, PilotLearner } from './pilotContract';

export function setPriorities(learner: PilotLearner, ids: string[]): PilotLearner {
  return { ...learner, priorityOutcomeIds: [...new Set(ids)] };
}

export function recordAssessment(learner: PilotLearner, input: {
  outcomeId: string; status: OutcomeStatus; evidenceIds: string[]; rationale: string; feedback: string;
}): PilotLearner {
  const selected = learner.evidence.filter(item => input.evidenceIds.includes(item.id));
  if (!input.rationale.trim() || !input.feedback.trim() || selected.length === 0 || selected.length !== input.evidenceIds.length || selected.some(item => item.outcomeId !== input.outcomeId)) {
    throw new Error('Choose matching evidence, feedback and a reason before assessing.');
  }
  const assessment: CoachAssessment = {
    ...input, id: crypto.randomUUID(), learnerId: learner.id, coachId: 'synthetic-coach',
    assessedAt: new Date().toISOString(), evidenceIds: [...input.evidenceIds],
  };
  return { ...learner, assessments: [...learner.assessments, assessment], coachMinutesThisWeek: learner.coachMinutesThisWeek + 5 };
}

export function prescribeTask(learner: PilotLearner, input: Omit<PersonalizedAssignment, 'id' | 'learnerId'>): PilotLearner {
  if (!input.title.trim() || !input.reason.trim() || !learner.priorityOutcomeIds.includes(input.outcomeId)) {
    throw new Error('Add a title, rationale and a priority outcome.');
  }
  return {
    ...learner,
    assignments: [...learner.assignments, { ...input, id: crypto.randomUUID(), learnerId: learner.id }],
    coachMinutesThisWeek: learner.coachMinutesThisWeek + 3,
  };
}
