import { useState } from 'react';
import { ChevronDown, ChevronRight, History as HistoryIcon, MessageSquare } from 'lucide-react';
import type { RevisionReviewStatus, SubmissionRevision } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { AttachmentLink } from './AttachmentLink';

const REVIEW_LABEL: Record<RevisionReviewStatus, string> = {
  pending: 'Chờ chấm',
  reviewed: 'Đã chấm',
  revision_requested: 'Yêu cầu làm lại',
};

const REVIEW_STYLE: Record<RevisionReviewStatus, string> = {
  pending: 'bg-sky-50 text-sky-700 ring-sky-200',
  reviewed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  revision_requested: 'bg-orange-50 text-orange-700 ring-orange-200',
};

function ReviewBadge({ status }: { status: RevisionReviewStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${REVIEW_STYLE[status]}`}
    >
      {REVIEW_LABEL[status]}
    </span>
  );
}

function RevisionItem({ revision }: { revision: SubmissionRevision }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  const hasFeedback =
    Boolean(revision.feedback_text) ||
    revision.feedback_score !== null ||
    Boolean(revision.reviewed_at);

  return (
    <li className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <Chevron className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Phiên bản {revision.revision_number}
          </span>
          <ReviewBadge status={revision.review_status} />
        </span>
        <span className="hidden text-xs text-slate-400 sm:block">
          Nộp: {formatDateTime(revision.submitted_at)}
          {hasFeedback ? ` • Chấm: ${formatDateTime(revision.reviewed_at)}` : ''}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Bài nộp của học viên
            </p>
            {revision.text_response ? (
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {revision.text_response}
              </p>
            ) : null}
            {revision.storage_path ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <AttachmentLink path={revision.storage_path} label="Mở tệp đã nộp" />
                {revision.duration_seconds !== null ? (
                  <span className="text-xs text-slate-400">{revision.duration_seconds}s</span>
                ) : null}
              </div>
            ) : null}
            {!revision.text_response && !revision.storage_path ? (
              <p className="mt-1 text-sm text-slate-400">Không có nội dung văn bản/tệp.</p>
            ) : null}
            <p className="mt-1 text-xs text-slate-400">
              Nộp lúc {formatDateTime(revision.submitted_at)}
            </p>
          </div>

          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700">
              <MessageSquare className="h-3.5 w-3.5" /> Phản hồi của coach
            </p>
            {hasFeedback ? (
              <>
                {revision.feedback_text ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">
                    {revision.feedback_text}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-emerald-700">
                  {revision.feedback_score !== null ? `Điểm: ${revision.feedback_score} • ` : ''}
                  {revision.reviewed_at
                    ? formatDateTime(revision.reviewed_at)
                    : REVIEW_LABEL[revision.review_status]}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-emerald-800/70">Chưa có phản hồi.</p>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Danh sách lịch sử phiên bản bài nộp (mới nhất trước, mở/đóng từng mục). */
export function RevisionHistory({
  revisions,
  title = 'Lịch sử bài nộp',
  embedded = false,
}: {
  revisions: SubmissionRevision[];
  title?: string;
  embedded?: boolean;
}) {
  if (revisions.length === 0) return null;
  const ordered = [...revisions].sort((a, b) => b.revision_number - a.revision_number);

  const body = (
    <>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <HistoryIcon className="h-4 w-4 text-emblue" /> {title}
      </p>
      <ol className="mt-3 space-y-2">
        {ordered.map((r) => (
          <RevisionItem key={r.id} revision={r} />
        ))}
      </ol>
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      {body}
    </section>
  );
}
