import { supabase } from '../lib/supabaseClient';
import type { Stage } from './ree';

export interface ModuleAttempt {
  id: string;
  task_id: string;
  module_id: string;
  content_version: number;
  student_id: string;
  attempt_number: number;
  inherited_evidence_attempt_id: string | null;
  resume_stage: Stage;
  completed_stages: Stage[];
  stage_data: Record<string, unknown>;
  status: 'in_progress' | 'awaiting_review' | 'revision_required' | 'mastered';
  verify_submission_id: string | null;
  completed_at: string | null;
  mastered_at: string | null;
}

export interface ActivityAttempt {
  id: string;
  attempt_id: string;
  activity_id: string;
  response: Record<string, unknown>;
  result: Record<string, { correct: boolean; answer: unknown; explanation: string }>;
  created_at: string;
}

export interface ModuleRecording {
  id: string;
  attempt_id: string;
  prompt_id: string;
  storage_path: string;
  duration_seconds: number;
  created_at: string;
}

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function startModuleAttempt(taskId: string): Promise<ModuleAttempt> {
  return unwrap<ModuleAttempt>(await supabase.rpc('start_coaching_module_attempt', { p_task_id: taskId }));
}

export async function saveModuleProgress(
  attemptId: string,
  stage: Stage,
  data: Record<string, unknown>,
  complete: boolean
): Promise<ModuleAttempt> {
  return unwrap<ModuleAttempt>(
    await supabase.rpc('save_coaching_module_progress', {
      p_attempt_id: attemptId,
      p_stage: stage,
      p_data: data,
      p_complete: complete,
    })
  );
}

export async function submitActivity(
  attemptId: string,
  activityId: string,
  response: Record<string, unknown>
): Promise<ActivityAttempt> {
  return unwrap<ActivityAttempt>(
    await supabase.rpc('submit_coaching_module_activity', {
      p_attempt_id: attemptId,
      p_activity_id: activityId,
      p_response: response,
    })
  );
}

export async function listActivityAttempts(attemptId: string): Promise<ActivityAttempt[]> {
  const result = await supabase
    .from('coaching_module_activity_attempts')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });
  return unwrap<ActivityAttempt[]>(result);
}

export async function listModuleAttemptsForTask(taskId: string): Promise<ModuleAttempt[]> {
  const result = await supabase
    .from('coaching_module_attempts')
    .select('*')
    .eq('task_id', taskId)
    .order('attempt_number', { ascending: true });
  return unwrap<ModuleAttempt[]>(result);
}

export async function listActivityHistoryForTask(taskId: string): Promise<ActivityAttempt[]> {
  const attempts = await listModuleAttemptsForTask(taskId);
  if (attempts.length === 0) return [];
  const result = await supabase
    .from('coaching_module_activity_attempts')
    .select('*')
    .in('attempt_id', attempts.map((item) => item.id))
    .order('created_at', { ascending: true });
  return unwrap<ActivityAttempt[]>(result);
}

export async function saveModuleRecording(
  attemptId: string,
  promptId: string,
  storagePath: string,
  durationSeconds: number
): Promise<ModuleRecording> {
  return unwrap<ModuleRecording>(
    await supabase.rpc('save_coaching_module_recording', {
      p_attempt_id: attemptId,
      p_prompt_id: promptId,
      p_storage_path: storagePath,
      p_duration_seconds: durationSeconds,
    })
  );
}

export async function listModuleRecordings(attemptId: string): Promise<ModuleRecording[]> {
  const result = await supabase
    .from('coaching_module_recordings')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });
  return unwrap<ModuleRecording[]>(result);
}

export async function listRecordingHistoryForTask(taskId: string): Promise<ModuleRecording[]> {
  const attempts = await listModuleAttemptsForTask(taskId);
  if (attempts.length === 0) return [];
  const result = await supabase
    .from('coaching_module_recordings')
    .select('*')
    .in('attempt_id', attempts.map((item) => item.id))
    .order('created_at', { ascending: true });
  return unwrap<ModuleRecording[]>(result);
}

export async function submitModuleVerify(
  attemptId: string,
  submissionId: string
): Promise<ModuleAttempt> {
  return unwrap<ModuleAttempt>(
    await supabase.rpc('submit_coaching_module_verify', {
      p_attempt_id: attemptId,
      p_submission_id: submissionId,
    })
  );
}

export async function getAttemptForSubmission(
  submissionId: string
): Promise<ModuleAttempt | null> {
  const result = await supabase
    .from('coaching_module_attempts')
    .select('*')
    .eq('verify_submission_id', submissionId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return unwrap<ModuleAttempt | null>(result);
}

export async function reviewModuleSubmission(input: {
  submissionId: string;
  feedbackText: string;
  scores: Record<string, number>;
  requestRevision: boolean;
  durationConfirmed: boolean;
}): Promise<ModuleAttempt> {
  return unwrap<ModuleAttempt>(
    await supabase.rpc('review_coaching_module_submission', {
      p_submission_id: input.submissionId,
      p_feedback_text: input.feedbackText,
      p_scores: input.scores,
      p_request_revision: input.requestRevision,
      p_duration_confirmed: input.durationConfirmed,
    })
  );
}
