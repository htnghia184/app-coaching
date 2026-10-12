// Domain types — bám đúng Migration 018 v2.2 (docs/DATABASE_V1.md). Không redesign schema.

export type UserRole = 'student' | 'teacher' | 'admin' | 'guest';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export type ProfileRef = Pick<Profile, 'id' | 'email' | 'full_name'>;

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type WeeklyPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

/** DB hỗ trợ 7 loại; Vertical Slice 01 chỉ tạo/quản lý 4 loại dưới đây. */
export type TaskType =
  | 'lesson'
  | 'practice'
  | 'text'
  | 'audio'
  | 'file'
  | 'checkoff'
  | 'assessment';

/** 4 loại task được expose trong Vertical Slice 01. */
export const SLICE_TASK_TYPES = ['text', 'audio', 'file', 'checkoff'] as const;
export type SliceTaskType = (typeof SLICE_TASK_TYPES)[number];

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'reviewed'
  | 'revision_requested';

/** baseline_data / target_data là JSONB vì ngữ nghĩa điểm khác nhau theo chương trình. */
export interface ScoreData {
  overall?: number | string;
  [key: string]: unknown;
}

export interface Enrollment {
  id: string;
  student_id: string;
  coach_id: string;
  program: string;
  goal_label: string;
  baseline_data: ScoreData;
  target_data: ScoreData;
  target_date: string | null;
  status: EnrollmentStatus;
  started_at: string;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentWithPeople extends Enrollment {
  student?: ProfileRef | null;
  coach?: ProfileRef | null;
}

export interface WeeklyPlan {
  id: string;
  enrollment_id: string;
  week_number: number;
  title: string;
  focus: string;
  coach_message: string;
  starts_on: string | null;
  ends_on: string | null;
  status: WeeklyPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface CoachingTask {
  id: string;
  weekly_plan_id: string;
  module_id: string | null;
  exam_id: string | null;
  task_type: TaskType;
  title: string;
  instructions: string;
  sequence: number;
  due_at: string | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  task_id: string;
  student_id: string;
  text_response: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  feedback_text: string | null;
  feedback_score: number | null;
  feedback_data: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Trạng thái review gắn với một phiên bản bài nộp (coaching_submission_revisions). */
export type RevisionReviewStatus = 'pending' | 'reviewed' | 'revision_requested';

/**
 * Lớp lịch sử bất biến (Migration 020) — mỗi bản ghi là một phiên bản bài nộp
 * của học viên cùng phản hồi coach (canonical) của chính phiên bản đó.
 */
export interface SubmissionRevision {
  id: string;
  submission_id: string;
  task_id: string;
  student_id: string;
  revision_number: number;
  text_response: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  submitted_at: string | null;
  review_status: RevisionReviewStatus;
  feedback_text: string | null;
  feedback_score: number | null;
  feedback_data: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Nhãn trạng thái task hiển thị cho học viên (docs/VERTICAL_SLICE_01 §8). */
export type StudentTaskStatusLabel =
  | 'Not started'
  | 'Draft'
  | 'Submitted'
  | 'Revision requested'
  | 'Reviewed';

export function getStudentTaskStatusLabel(
  submission: Submission | undefined
): StudentTaskStatusLabel {
  if (!submission) return 'Not started';
  switch (submission.status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'Submitted';
    case 'revision_requested':
      return 'Revision requested';
    case 'reviewed':
      return 'Reviewed';
    default:
      return 'Not started';
  }
}

/** Nhãn tiếng Việt của trạng thái task (Slice 02 — không lộ enum nội bộ cho học viên). */
export const STUDENT_TASK_STATUS_VI: Record<StudentTaskStatusLabel, string> = {
  'Not started': 'Chưa làm',
  Draft: 'Bản nháp',
  Submitted: 'Đã nộp',
  'Revision requested': 'Cần chỉnh sửa',
  Reviewed: 'Đã hoàn thành',
};

export function getStudentTaskStatusVi(submission: Submission | undefined): string {
  return STUDENT_TASK_STATUS_VI[getStudentTaskStatusLabel(submission)];
}

/* ------------------------------------------------------------------ */
/* Roadmap (bảng đã deploy từ Migration 018, Slice 02 mới dùng)        */
/* ------------------------------------------------------------------ */

export type RoadmapStatus = 'draft' | 'active' | 'completed' | 'archived';
export type RoadmapItemStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface Roadmap {
  id: string;
  enrollment_id: string;
  title: string;
  status: RoadmapStatus;
  created_at: string;
  updated_at: string;
}

export interface RoadmapItem {
  id: string;
  roadmap_id: string;
  module_id: string | null;
  title: string;
  description: string;
  sequence: number;
  status: RoadmapItemStatus;
  created_at: string;
  updated_at: string;
}

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  draft: 'Bản nháp',
  active: 'Đang thực hiện',
  completed: 'Hoàn thành',
  archived: 'Đã lưu trữ',
};

export const ROADMAP_ITEM_STATUS_LABEL: Record<RoadmapItemStatus, string> = {
  locked: 'Chưa mở',
  available: 'Có thể bắt đầu',
  in_progress: 'Đang học',
  completed: 'Hoàn thành',
  skipped: 'Bỏ qua',
};

export const ROADMAP_ITEM_STATUS_ORDER: RoadmapItemStatus[] = [
  'locked',
  'available',
  'in_progress',
  'completed',
  'skipped',
];
