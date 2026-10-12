// Service layer: mọi truy cập Supabase cho Coaching đi qua đây (không gọi API rải rác trong component).
// Tất cả truy vấn dùng session của người dùng đang đăng nhập để RLS được thực thi.

import { supabase } from './supabaseClient';
import type {
  CoachingTask,
  Enrollment,
  EnrollmentStatus,
  EnrollmentWithPeople,
  Profile,
  ProfileRef,
  Roadmap,
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapStatus,
  ScoreData,
  Submission,
  SubmissionRevision,
  TaskType,
  UserRole,
  WeeklyPlan,
} from './types';

export const COACHING_BUCKET = 'coaching-submissions';

// FK constraint names do Postgres sinh ra cho coaching_enrollments.
const ENROLLMENT_PEOPLE_SELECT =
  '*, student:profiles!coaching_enrollments_student_id_fkey(id,email,full_name), ' +
  'coach:profiles!coaching_enrollments_coach_id_fkey(id,email,full_name)';

function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? 'Lỗi không xác định từ Supabase');
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('id', userId)
    .maybeSingle();
  if (error) fail(error);
  return (data as Profile | null) ?? null;
}

export async function listProfilesByRole(
  role: Extract<UserRole, 'student' | 'teacher'>
): Promise<ProfileRef[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name')
    .eq('role', role)
    .order('full_name', { ascending: true, nullsFirst: false });
  if (error) fail(error);
  return (data ?? []) as ProfileRef[];
}

/* ------------------------------------------------------------------ */
/* Enrollments                                                         */
/* ------------------------------------------------------------------ */

export interface CreateEnrollmentInput {
  student_id: string;
  coach_id: string;
  program: string;
  goal_label: string;
  baseline_data: ScoreData;
  target_data: ScoreData;
  target_date: string | null;
  status?: EnrollmentStatus;
}

export async function createEnrollment(
  input: CreateEnrollmentInput
): Promise<Enrollment> {
  const { data, error } = await supabase
    .from('coaching_enrollments')
    .insert({
      student_id: input.student_id,
      coach_id: input.coach_id,
      program: input.program,
      goal_label: input.goal_label,
      baseline_data: input.baseline_data,
      target_data: input.target_data,
      target_date: input.target_date,
      status: input.status ?? 'active',
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as Enrollment;
}

export async function listEnrollmentsForCoach(
  coachId: string
): Promise<EnrollmentWithPeople[]> {
  const { data, error } = await supabase
    .from('coaching_enrollments')
    .select(ENROLLMENT_PEOPLE_SELECT)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as EnrollmentWithPeople[];
}

export async function getEnrollment(
  enrollmentId: string
): Promise<EnrollmentWithPeople | null> {
  const { data, error } = await supabase
    .from('coaching_enrollments')
    .select(ENROLLMENT_PEOPLE_SELECT)
    .eq('id', enrollmentId)
    .maybeSingle();
  if (error) fail(error);
  return (data as unknown as EnrollmentWithPeople | null) ?? null;
}

/** Admin xem toàn bộ enrollment (RLS admin cho phép). */
export async function listAllEnrollments(): Promise<EnrollmentWithPeople[]> {
  const { data, error } = await supabase
    .from('coaching_enrollments')
    .select(ENROLLMENT_PEOPLE_SELECT)
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as unknown as EnrollmentWithPeople[];
}

export async function getActiveEnrollmentForStudent(
  studentId: string
): Promise<EnrollmentWithPeople | null> {
  const { data, error } = await supabase
    .from('coaching_enrollments')
    .select(ENROLLMENT_PEOPLE_SELECT)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail(error);
  return (data as unknown as EnrollmentWithPeople | null) ?? null;
}

/* ------------------------------------------------------------------ */
/* Weekly plans & tasks                                                */
/* ------------------------------------------------------------------ */

export async function listWeeklyPlans(enrollmentId: string): Promise<WeeklyPlan[]> {
  const { data, error } = await supabase
    .from('coaching_weekly_plans')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('week_number', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as WeeklyPlan[];
}

/** Batch nhiều enrollment trong một query (tránh N+1 trên Coach Dashboard). */
export async function listWeeklyPlansForEnrollments(
  enrollmentIds: string[]
): Promise<WeeklyPlan[]> {
  if (enrollmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coaching_weekly_plans')
    .select('*')
    .in('enrollment_id', enrollmentIds)
    .order('week_number', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as WeeklyPlan[];
}

export async function listTasksForPlans(planIds: string[]): Promise<CoachingTask[]> {
  if (planIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coaching_tasks')
    .select('*')
    .in('weekly_plan_id', planIds)
    .order('sequence', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as CoachingTask[];
}

export async function getTask(taskId: string): Promise<CoachingTask | null> {
  const { data, error } = await supabase
    .from('coaching_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (error) fail(error);
  return (data as CoachingTask | null) ?? null;
}

export interface CreateWeeklyPlanInput {
  enrollment_id: string;
  week_number: number;
  title: string;
  focus: string;
  coach_message: string;
  starts_on: string | null;
  ends_on: string | null;
}

export async function createWeeklyPlan(
  input: CreateWeeklyPlanInput
): Promise<WeeklyPlan> {
  const { data, error } = await supabase
    .from('coaching_weekly_plans')
    .insert({
      enrollment_id: input.enrollment_id,
      week_number: input.week_number,
      title: input.title,
      focus: input.focus,
      coach_message: input.coach_message,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as WeeklyPlan;
}

export interface CreateTaskInput {
  weekly_plan_id: string;
  task_type: TaskType;
  title: string;
  instructions: string;
  sequence: number;
  due_at: string | null;
  is_required: boolean;
}

export async function createTask(input: CreateTaskInput): Promise<CoachingTask> {
  const { data, error } = await supabase
    .from('coaching_tasks')
    .insert({
      weekly_plan_id: input.weekly_plan_id,
      task_type: input.task_type,
      title: input.title,
      instructions: input.instructions,
      sequence: input.sequence,
      due_at: input.due_at,
      is_required: input.is_required,
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as CoachingTask;
}

/* ------------------------------------------------------------------ */
/* Roadmaps (bảng đã deploy — Slice 02)                                */
/* ------------------------------------------------------------------ */

export async function listRoadmaps(enrollmentId: string): Promise<Roadmap[]> {
  const { data, error } = await supabase
    .from('coaching_roadmaps')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as Roadmap[];
}

/** Batch nhiều enrollment trong một query (tránh N+1 trên Coach Dashboard). */
export async function listRoadmapsForEnrollments(
  enrollmentIds: string[]
): Promise<Roadmap[]> {
  if (enrollmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coaching_roadmaps')
    .select('*')
    .in('enrollment_id', enrollmentIds);
  if (error) fail(error);
  return (data ?? []) as Roadmap[];
}

export async function listRoadmapItems(roadmapIds: string[]): Promise<RoadmapItem[]> {
  if (roadmapIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coaching_roadmap_items')
    .select('*')
    .in('roadmap_id', roadmapIds)
    .order('sequence', { ascending: true });
  if (error) fail(error);
  return (data ?? []) as RoadmapItem[];
}

export interface CreateRoadmapInput {
  enrollment_id: string;
  title: string;
  status?: RoadmapStatus;
}

export async function createRoadmap(input: CreateRoadmapInput): Promise<Roadmap> {
  const { data, error } = await supabase
    .from('coaching_roadmaps')
    .insert({
      enrollment_id: input.enrollment_id,
      title: input.title,
      status: input.status ?? 'active',
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as Roadmap;
}

export interface UpdateRoadmapInput {
  roadmap_id: string;
  title?: string;
  status?: RoadmapStatus;
}

export async function updateRoadmap(input: UpdateRoadmapInput): Promise<Roadmap> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabase
    .from('coaching_roadmaps')
    .update(patch)
    .eq('id', input.roadmap_id)
    .select('*')
    .single();
  if (error) fail(error);
  return data as Roadmap;
}

export interface CreateRoadmapItemInput {
  roadmap_id: string;
  title: string;
  description: string;
  sequence: number;
  status: RoadmapItemStatus;
}

export async function createRoadmapItem(
  input: CreateRoadmapItemInput
): Promise<RoadmapItem> {
  const { data, error } = await supabase
    .from('coaching_roadmap_items')
    .insert({
      roadmap_id: input.roadmap_id,
      title: input.title,
      description: input.description,
      sequence: input.sequence,
      status: input.status,
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as RoadmapItem;
}

export interface UpdateRoadmapItemInput {
  item_id: string;
  title?: string;
  description?: string;
  status?: RoadmapItemStatus;
}

export async function updateRoadmapItem(
  input: UpdateRoadmapItemInput
): Promise<RoadmapItem> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabase
    .from('coaching_roadmap_items')
    .update(patch)
    .eq('id', input.item_id)
    .select('*')
    .single();
  if (error) fail(error);
  return data as RoadmapItem;
}

/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

export async function listSubmissionsForTasks(
  taskIds: string[]
): Promise<Submission[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coaching_submissions')
    .select('*')
    .in('task_id', taskIds);
  if (error) fail(error);
  return (data ?? []) as Submission[];
}

export async function getSubmission(
  taskId: string,
  studentId: string
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('coaching_submissions')
    .select('*')
    .eq('task_id', taskId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) fail(error);
  return (data as Submission | null) ?? null;
}

/**
 * Lịch sử các phiên bản bài nộp (Migration 020) cho một hoặc nhiều submission.
 * Read-only: RLS chỉ cho học viên đọc lịch sử của chính mình, coach đọc lịch sử
 * của học viên được assign. Sắp xếp mới nhất trước.
 */
export async function listSubmissionRevisions(
  submissionIds: string[]
): Promise<SubmissionRevision[]> {
  if (submissionIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coaching_submission_revisions')
    .select('*')
    .in('submission_id', submissionIds)
    .order('revision_number', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as SubmissionRevision[];
}

export interface CreateSubmissionInput {
  task_id: string;
  student_id: string;
  text_response: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  submit: boolean;
}

/**
 * Tạo submission mới trực tiếp bằng INSERT (RLS cho phép với điều kiện student_id = auth.uid()
 * và không set bất kỳ field feedback/review nào).
 * `submitted_at` không có default ở DB nên phải set tường minh khi submit.
 */
export async function createSubmission(
  input: CreateSubmissionInput
): Promise<Submission> {
  const { data, error } = await supabase
    .from('coaching_submissions')
    .insert({
      task_id: input.task_id,
      student_id: input.student_id,
      text_response: input.text_response,
      storage_path: input.storage_path,
      duration_seconds: input.duration_seconds,
      status: input.submit ? 'submitted' : 'draft',
      submitted_at: input.submit ? new Date().toISOString() : null,
    })
    .select('*')
    .single();
  if (error) fail(error);
  return data as Submission;
}

export interface UpdateSubmissionInput {
  submission_id: string;
  text_response: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  submit: boolean;
}

/**
 * Cập nhật submission đã tồn tại — BẮT BUỘC qua RPC an toàn.
 * RPC chỉ cho đổi text_response/storage_path/duration_seconds/status/submitted_at.
 */
export async function updateOwnSubmission(
  input: UpdateSubmissionInput
): Promise<Submission> {
  const { data, error } = await supabase.rpc('update_own_coaching_submission', {
    p_submission_id: input.submission_id,
    p_text_response: input.text_response,
    p_storage_path: input.storage_path,
    p_duration_seconds: input.duration_seconds,
    p_submit: input.submit,
  });
  if (error) fail(error);
  return data as Submission;
}

export interface ReviewSubmissionInput {
  submission_id: string;
  feedback_text: string;
  feedback_score: number | null;
  request_revision: boolean;
}

/**
 * Coach review — BẮT BUỘC qua RPC an toàn (coach không có UPDATE trực tiếp trên submissions).
 * Vertical Slice 01: feedback_data = {}.
 */
export async function reviewSubmission(
  input: ReviewSubmissionInput
): Promise<Submission> {
  const { data, error } = await supabase.rpc('review_coaching_submission', {
    p_submission_id: input.submission_id,
    p_feedback_text: input.feedback_text,
    p_feedback_score: input.feedback_score,
    p_feedback_data: {},
    p_request_revision: input.request_revision,
  });
  if (error) fail(error);
  return data as Submission;
}

/* ------------------------------------------------------------------ */
/* Private storage                                                     */
/* ------------------------------------------------------------------ */

function safeExtension(fileName: string, mime: string): string {
  const fromName = fileName.includes('.')
    ? `.${fileName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    : '';
  if (fromName && fromName.length <= 6) return fromName;
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('mpeg')) return '.mp3';
  if (mime.includes('mp4')) return '.m4a';
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('pdf')) return '.pdf';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  return '';
}

/** Upload file học viên vào bucket private, path: {student_uuid}/{task_uuid}/{unique_filename}. */
export async function uploadCoachingFile(
  studentId: string,
  taskId: string,
  file: Blob,
  fileName: string
): Promise<string> {
  const ext = safeExtension(fileName, file.type);
  const unique = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const path = `${studentId}/${taskId}/${unique}`;
  const { error } = await supabase.storage
    .from(COACHING_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) fail(error);
  return path;
}

/** Tạo signed URL có thời hạn để đọc file private (không lưu URL này vào DB). */
export async function createSignedFileUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(COACHING_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) fail(error);
  return data.signedUrl;
}
