import type { ActivityAttempt, ModuleRecording } from './moduleService';

export function latestRecording(items: ModuleRecording[], promptId: string): ModuleRecording | undefined {
  return [...items].reverse().find((item) => item.prompt_id === promptId);
}

export function latestCurrentRecording(
  items: ModuleRecording[], promptId: string, attemptId: string
): ModuleRecording | undefined {
  return latestRecording(items.filter((item) => item.attempt_id === attemptId), promptId);
}

export function latestActivity(items: ActivityAttempt[], activityId: string): ActivityAttempt | undefined {
  return [...items].reverse().find((item) => item.activity_id === activityId);
}
