import type {
  RoadmapItemStatus,
  StudentTaskStatusLabel,
  SubmissionStatus,
} from '../lib/types';
import { ROADMAP_ITEM_STATUS_LABEL, STUDENT_TASK_STATUS_VI } from '../lib/types';

const STYLES: Record<StudentTaskStatusLabel, string> = {
  'Not started': 'bg-slate-100 text-slate-600 ring-slate-200',
  Draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  Submitted: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Revision requested': 'bg-orange-50 text-orange-700 ring-orange-200',
  Reviewed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function StatusBadge({ label }: { label: StudentTaskStatusLabel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[label]}`}
    >
      {STUDENT_TASK_STATUS_VI[label]}
    </span>
  );
}

const SUBMISSION_STYLE: Record<SubmissionStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  submitted: 'bg-sky-50 text-sky-700 ring-sky-200',
  revision_requested: 'bg-orange-50 text-orange-700 ring-orange-200',
  reviewed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const SUBMISSION_LABEL: Record<SubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  revision_requested: 'Revision requested',
  reviewed: 'Reviewed',
};

export function SubmissionBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${SUBMISSION_STYLE[status]}`}
    >
      {SUBMISSION_LABEL[status]}
    </span>
  );
}

const ROADMAP_ITEM_STYLE: Record<RoadmapItemStatus, string> = {
  locked: 'bg-slate-100 text-slate-500 ring-slate-200',
  available: 'bg-sky-50 text-sky-700 ring-sky-200',
  in_progress: 'bg-emblue/10 text-emblue-dark ring-emblue/30',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  skipped: 'bg-slate-100 text-slate-400 ring-slate-200',
};

/** Nhãn trạng thái stage lộ trình (tiếng Việt). */
export function RoadmapItemBadge({ status }: { status: RoadmapItemStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ROADMAP_ITEM_STYLE[status]}`}
    >
      {ROADMAP_ITEM_STATUS_LABEL[status]}
    </span>
  );
}
