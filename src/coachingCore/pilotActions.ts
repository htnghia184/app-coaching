import type { CoachAssessment, CoachingEvidence, EvidenceSource, OutcomeStatus, PersonalizedAssignment, PilotLearner } from './pilotContract';

export function setPriorities(learner: PilotLearner, ids: string[]): PilotLearner {
  return { ...learner, priorityOutcomeIds: [...new Set(ids)] };
}

export function recordAssessment(learner: PilotLearner, input: {
  outcomeId: string; status: OutcomeStatus; evidenceIds: string[]; rationale: string; feedback: string; minutes: number;
}): PilotLearner {
  const selected = learner.evidence.filter(item => input.evidenceIds.includes(item.id));
  if (!input.rationale.trim() || !input.feedback.trim() || selected.length === 0 || selected.length !== input.evidenceIds.length || selected.some(item => item.outcomeId !== input.outcomeId) || !Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 480) {
    throw new Error('Choose matching evidence, feedback and a reason before assessing.');
  }
  const assessment: CoachAssessment = {
    outcomeId: input.outcomeId, status: input.status, evidenceIds: [...input.evidenceIds], rationale: input.rationale,
    feedback: input.feedback, id: crypto.randomUUID(), learnerId: learner.id, coachId: 'synthetic-coach',
    assessedAt: new Date().toISOString(),
  };
  return { ...learner, assessments: [...learner.assessments, assessment], coachMinutesThisWeek: learner.coachMinutesThisWeek + input.minutes };
}

export function prescribeTask(learner: PilotLearner, input: Omit<PersonalizedAssignment, 'id' | 'learnerId'>, minutes: number): PilotLearner {
  if (!input.title.trim() || !input.reason.trim() || !learner.priorityOutcomeIds.includes(input.outcomeId) || !Number.isInteger(minutes) || minutes < 1 || minutes > 480
    || (input.evidenceExpected === 'module_submission' ? !input.moduleId || !input.moduleVersion : input.moduleId !== null || input.moduleVersion !== null)) {
    throw new Error('Add a title, rationale and a priority outcome.');
  }
  return {
    ...learner,
    assignments: [...learner.assignments, { ...input, id: crypto.randomUUID(), learnerId: learner.id }],
    coachMinutesThisWeek: learner.coachMinutesThisWeek + minutes,
  };
}

export function submitEvidence(learner: PilotLearner, input: { assignmentId: string; source: EvidenceSource; summary: string }): PilotLearner {
  const assignment = learner.assignments.find(item => item.id === input.assignmentId);
  if (!assignment || assignment.evidenceExpected !== input.source || !input.summary.trim()) throw new Error('Choose the assigned evidence path and describe the work.');
  const evidence: CoachingEvidence = {
    id: crypto.randomUUID(), learnerId: learner.id, outcomeId: assignment.outcomeId,
    source: input.source, sourceRef: `synthetic:${assignment.id}:revision:${learner.evidence.filter(item => item.sourceRef.startsWith(`synthetic:${assignment.id}:`)).length + 1}`,
    summary: input.summary.trim(), capturedAt: new Date().toISOString(),
  };
  return { ...learner, evidence: [...learner.evidence, evidence] };
}
