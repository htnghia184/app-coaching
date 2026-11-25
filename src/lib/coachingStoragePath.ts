export function coachingStoragePath(
  studentId: string,
  taskId: string,
  fileName: string,
  moduleAttemptId?: string
): string {
  return `${studentId}/${taskId}/${moduleAttemptId ? `${moduleAttemptId}/` : ''}${fileName}`;
}
