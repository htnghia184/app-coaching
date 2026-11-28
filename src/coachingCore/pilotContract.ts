export type EvidenceSource = 'module_submission' | 'task_submission' | 'live_session_note';
export type OutcomeStatus = 'not_assessed' | 'emerging' | 'developing' | 'demonstrated' | 'needs_recheck';
export interface OutcomeRef { id: string; version: number }

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
  outcomeVersion: number;
  source: EvidenceSource;
  sourceRef: string;
  summary: string;
  capturedAt: string;
}

export interface CoachAssessment {
  id: string;
  learnerId: string;
  outcomeId: string;
  outcomeVersion: number;
  status: OutcomeStatus;
  evidenceIds: string[];
  rationale: string;
  feedback?: string;
  assessedAt: string;
  coachId: string;
}

export interface PersonalizedAssignment {
  id: string;
  learnerId: string;
  outcomes: OutcomeRef[];
  title: string;
  reason: string;
  moduleId: string | null;
  moduleVersion: number | null;
  evidenceExpected: EvidenceSource;
  due: string;
}

export interface PilotLearner {
  id: string;
  name: string;
  target: string;
  priorityOutcomes: OutcomeRef[];
  assignments: PersonalizedAssignment[];
  evidence: CoachingEvidence[];
  assessments: CoachAssessment[];
  coachMinutesThisWeek: number;
}
