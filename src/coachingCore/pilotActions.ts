import type { CoachAssessment, CoachingEvidence, EvidenceSource, OutcomeRef, OutcomeStatus, PersonalizedAssignment, PilotLearner } from './pilotContract';

const refKey = (ref: OutcomeRef) => `${ref.id}:${ref.version}`;

export function setPriorities(learner: PilotLearner, refs: OutcomeRef[]): PilotLearner {
  if (refs.some(ref => !ref.id || !Number.isInteger(ref.version) || ref.version < 1)) throw new Error('Valid versioned priorities required.');
  return { ...learner, priorityOutcomes: refs.filter((ref, index) => refs.findIndex(item => refKey(item) === refKey(ref)) === index) };
}

export function recordAssessment(learner: PilotLearner, input: {
  outcomeId: string; outcomeVersion: number; status: OutcomeStatus; evidenceIds: string[]; rationale: string; feedback: string; minutes: number;
}): PilotLearner {
  const selected = learner.evidence.filter(item => input.evidenceIds.includes(item.id));
  if (!input.rationale.trim() || !input.feedback.trim() || selected.length === 0 || selected.length !== input.evidenceIds.length || selected.some(item => item.outcomeId !== input.outcomeId || item.outcomeVersion !== input.outcomeVersion) || !Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 480) {
    throw new Error('Choose matching evidence, feedback and a reason before assessing.');
  }
  const assessment: CoachAssessment = {
    outcomeId: input.outcomeId, outcomeVersion: input.outcomeVersion, status: input.status, evidenceIds: [...input.evidenceIds], rationale: input.rationale,
    feedback: input.feedback, id: crypto.randomUUID(), learnerId: learner.id, coachId: 'synthetic-coach',
    assessedAt: new Date().toISOString(),
  };
  return { ...learner, assessments: [...learner.assessments, assessment], coachMinutesThisWeek: learner.coachMinutesThisWeek + input.minutes };
}

export function prescribeTask(learner: PilotLearner, input: Omit<PersonalizedAssignment, 'id' | 'learnerId'>, minutes: number): PilotLearner {
  const priorities = new Set(learner.priorityOutcomes.map(refKey));
  if (!input.title.trim() || !input.reason.trim() || input.outcomes.some(ref => !priorities.has(refKey(ref)))
    || new Set(input.outcomes.map(refKey)).size !== input.outcomes.length || !Number.isInteger(minutes) || minutes < 1 || minutes > 480
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
  const revision = new Set(learner.evidence.filter(item => item.sourceRef.startsWith(`synthetic:${assignment.id}:`)).map(item => item.sourceRef)).size + 1;
  const sourceRef = `synthetic:${assignment.id}:revision:${revision}`;
  const evidence: CoachingEvidence[] = assignment.outcomes.map(ref => ({
    id: crypto.randomUUID(), learnerId: learner.id, outcomeId: ref.id, outcomeVersion: ref.version,
    source: input.source, sourceRef, summary: input.summary.trim(), capturedAt: new Date().toISOString(),
  }));
  return { ...learner, evidence: [...learner.evidence, ...evidence] };
}
