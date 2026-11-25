import type { ModuleRecording } from './moduleService';

export function reviewRecording(
  currentAttemptId: string,
  inheritedAttemptId: string | null,
  current: ModuleRecording[],
  inherited: ModuleRecording[],
  promptId: string
): { recording: ModuleRecording; inherited: boolean } | null {
  const own = [...current].reverse().find((item) =>
    item.attempt_id === currentAttemptId && item.prompt_id === promptId);
  if (own) return { recording: own, inherited: false };
  if (promptId === 'verify' || !inheritedAttemptId) return null;
  const earlier = [...inherited].reverse().find((item) =>
    item.attempt_id === inheritedAttemptId && item.prompt_id === promptId);
  return earlier ? { recording: earlier, inherited: true } : null;
}

export function meetsReeMastery(
  scores: Record<string, number | undefined>,
  durationSeconds: number,
  requestRevision: boolean
): boolean {
  const values = ['respond','explain','example','coherence'].map((key) => scores[key]);
  return !requestRevision && durationSeconds >= 20 && durationSeconds <= 30 &&
    values.every((score) => Number.isInteger(score) && score! >= 1 && score! <= 2) &&
    values.reduce<number>((sum, score) => sum + score!, 0) >= 6;
}
