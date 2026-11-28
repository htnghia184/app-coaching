import { supabase } from './supabaseClient';
import { parsePublicModule, type PublicModule } from '../modules/genericEngine';

export function requireLocalPilot(): void {
  if (!import.meta.env.DEV || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(import.meta.env.VITE_SUPABASE_URL ?? '')) {
    throw new Error('Authenticated pilot tools require Supabase Local.');
  }
}

function result<T>(value: { data: unknown; error: { message: string } | null }): T {
  if (value.error) throw new Error(value.error.message);
  return value.data as T;
}

export interface GenericVersion { module_key: string; content_version: number; module_id: string; manifest: PublicModule }
export interface GenericAssignment { task_id: string; module_key: string; content_version: number }
export interface GenericAttempt { id: string; task_id: string; student_id: string; module_key: string; content_version: number; status: string; completed_stages: string[] }

export async function listGenericVersions(): Promise<GenericVersion[]> {
  requireLocalPilot();
  const rows = result<GenericVersion[]>(await supabase.from('coaching_generic_module_versions').select('module_key,content_version,module_id,manifest'));
  return rows.flatMap(row => {
    try { return [{ ...row, manifest: parsePublicModule(row.manifest) }]; }
    catch { return []; }
  });
}

export async function getGenericAssignment(taskId: string): Promise<{ assignment: GenericAssignment; version: GenericVersion } | null> {
  requireLocalPilot();
  const assignment = result<GenericAssignment | null>(await supabase.from('coaching_generic_task_assignments').select('task_id,module_key,content_version').eq('task_id', taskId).maybeSingle());
  if (!assignment) return null;
  const version = result<GenericVersion>(await supabase.from('coaching_generic_module_versions').select('module_key,content_version,module_id,manifest').eq('module_key', assignment.module_key).eq('content_version', assignment.content_version).single());
  return { assignment, version: { ...version, manifest: parsePublicModule(version.manifest) } };
}

export async function assignGenericModule(taskId: string, moduleKey: string, version: number): Promise<void> {
  requireLocalPilot();
  result(await supabase.rpc('assign_generic_coaching_module', { p_task: taskId, p_module_key: moduleKey, p_content_version: version }));
}

export async function prescribeCoachingTask(input: { planId: string; title: string; reason: string; moduleKey: string | null; contentVersion: number | null; targets: { id: string; version: number }[]; minutes: number; requestKey: string }): Promise<{ id: string }> {
  requireLocalPilot();
  return result(await supabase.rpc('prescribe_coaching_task_atomic', {
    p_plan: input.planId, p_title: input.title, p_reason: input.reason,
    p_module_key: input.moduleKey, p_content_version: input.contentVersion,
    p_targets: input.targets, p_minutes: input.minutes, p_request_key: input.requestKey,
  }));
}

export async function startGenericAttempt(taskId: string): Promise<GenericAttempt> {
  requireLocalPilot();
  return result(await supabase.rpc('start_generic_coaching_attempt', { p_task: taskId }));
}

export async function saveGenericResponse(attemptId: string, activityId: string, response: Record<string, unknown>): Promise<void> {
  requireLocalPilot();
  result(await supabase.rpc('save_generic_coaching_response', { p_attempt: attemptId, p_activity: activityId, p_response: response }));
}

export async function completeGenericStage(attemptId: string, stage: string): Promise<GenericAttempt> {
  requireLocalPilot();
  return result(await supabase.rpc('complete_generic_coaching_stage', { p_attempt: attemptId, p_stage: stage }));
}

export async function saveGenericRecording(attemptId: string, promptId: string, path: string, seconds: number): Promise<void> {
  requireLocalPilot();
  result(await supabase.rpc('save_generic_coaching_recording', { p_attempt: attemptId, p_prompt: promptId, p_path: path, p_seconds: seconds }));
}

export async function submitGenericVerifyAtomic(attemptId: string, answer: string, requestKey: string): Promise<void> {
  requireLocalPilot();
  result(await supabase.rpc('submit_generic_coaching_verify_atomic', { p_attempt: attemptId, p_text_response: answer, p_request_key: requestKey }));
}
