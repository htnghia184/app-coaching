export type EvidenceSource = 'module_attempt' | 'task_submission' | 'live_session_note';
export type OutcomeStatus = 'not_assessed' | 'emerging' | 'developing' | 'demonstrated' | 'needs_recheck';

export interface LearningOutcome {
  id: string;
  version: number;
  statement: string;
  successCriteria: string;
}

export interface CoachingEvidence {
  id: string;
  learnerId: string;
  outcomeId: string;
  source: EvidenceSource;
  sourceRef: string;
  summary: string;
  capturedAt: string;
}

export interface CoachAssessment {
  id: string;
  learnerId: string;
  outcomeId: string;
  status: OutcomeStatus;
  evidenceIds: string[];
  rationale: string;
  assessedAt: string;
  coachId: string;
}

export interface PersonalizedAssignment {
  id: string;
  learnerId: string;
  outcomeId: string;
  title: string;
  reason: string;
  moduleId: string | null;
  evidenceExpected: EvidenceSource;
  due: string;
}

export interface PilotLearner {
  id: string;
  name: string;
  target: string;
  priorityOutcomeIds: string[];
  assignments: PersonalizedAssignment[];
  evidence: CoachingEvidence[];
  assessments: CoachAssessment[];
  coachMinutesThisWeek: number;
}
