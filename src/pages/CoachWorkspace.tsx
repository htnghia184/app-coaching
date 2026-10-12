import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Pencil,
  Plus,
} from 'lucide-react';
import {
  createRoadmap,
  createRoadmapItem,
  createTask,
  createWeeklyPlan,
  getEnrollment,
  listRoadmapItems,
  listRoadmaps,
  listSubmissionRevisions,
  listSubmissionsForTasks,
  listTasksForPlans,
  listWeeklyPlans,
  reviewSubmission,
  updateRoadmap,
  updateRoadmapItem,
} from '../lib/coachingService';
import {
  formatDate,
  formatDateTime,
  formatScore,
  learnerLabel,
} from '../lib/format';
import {
  ROADMAP_ITEM_STATUS_LABEL,
  ROADMAP_ITEM_STATUS_ORDER,
  ROADMAP_STATUS_LABEL,
  SLICE_TASK_TYPES,
} from '../lib/types';
import type {
  CoachingTask,
  EnrollmentWithPeople,
  Roadmap,
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapStatus,
  SliceTaskType,
  Submission,
  SubmissionRevision,
  WeeklyPlan,
} from '../lib/types';
import { RoadmapItemBadge, SubmissionBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { AttachmentLink } from '../components/AttachmentLink';
import { RevisionHistory } from '../components/RevisionHistory';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emblue focus:ring-2 focus:ring-emblue/20';

const TASK_TYPE_LABEL: Record<SliceTaskType, string> = {
  text: 'Text response',
  audio: 'Audio recording',
  file: 'File upload',
  checkoff: 'Check-off',
};

export function CoachWorkspace() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const [enrollment, setEnrollment] = useState<EnrollmentWithPeople | null>(null);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [tasks, setTasks] = useState<CoachingTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [revisions, setRevisions] = useState<SubmissionRevision[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError('');
    try {
      const en = await getEnrollment(enrollmentId);
      if (!en) {
        setEnrollment(null);
        setError('Không tìm thấy enrollment hoặc bạn không có quyền truy cập.');
        return;
      }
      setEnrollment(en);

      const plansData = await listWeeklyPlans(en.id);
      setPlans(plansData);

      const tasksData = await listTasksForPlans(plansData.map((p) => p.id));
      setTasks(tasksData);

      const subs = await listSubmissionsForTasks(tasksData.map((t) => t.id));
      setSubmissions(subs);
      setRevisions(await listSubmissionRevisions(subs.map((s) => s.id)));

      const roadmapsData = await listRoadmaps(en.id);
      setRoadmaps(roadmapsData);
      setRoadmapItems(await listRoadmapItems(roadmapsData.map((r) => r.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được workspace');
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tasksByPlan = useMemo(() => {
    const map = new Map<string, CoachingTask[]>();
    for (const t of tasks) {
      const list = map.get(t.weekly_plan_id) ?? [];
      list.push(t);
      map.set(t.weekly_plan_id, list);
    }
    return map;
  }, [tasks]);

  const submissionByTask = useMemo(() => {
    const map = new Map<string, Submission>();
    for (const s of submissions) map.set(s.task_id, s);
    return map;
  }, [submissions]);

  const revisionsBySubmission = useMemo(() => {
    const map = new Map<string, SubmissionRevision[]>();
    for (const r of revisions) {
      const list = map.get(r.submission_id) ?? [];
      list.push(r);
      map.set(r.submission_id, list);
    }
    return map;
  }, [revisions]);

  if (loading) return <Spinner label="Đang tải workspace..." />;

  if (!enrollment) {
    return (
      <div className="page-container">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'Không tìm thấy enrollment.'}
        </div>
        <Link
          to="/coach"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emblue"
        >
          <ArrowLeft className="h-4 w-4" /> Về danh sách học viên
        </Link>
      </div>
    );
  }

  const nextWeekNumber = plans.reduce((m, p) => Math.max(m, p.week_number), 0) + 1;

  return (
    <div className="page-container space-y-6">
      <Link
        to="/coach"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emblue"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách học viên
      </Link>

      {/* Header: mục tiêu học viên */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-master sm:text-2xl">
              {learnerLabel(enrollment.student, enrollment.student_id)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {enrollment.program}
              {enrollment.goal_label ? ` • ${enrollment.goal_label}` : ''}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {enrollment.status}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Baseline" value={formatScore(enrollment.baseline_data)} />
          <Stat label="Target" value={formatScore(enrollment.target_data)} />
          <Stat label="Ngày mục tiêu" value={formatDate(enrollment.target_date)} />
          <Stat label="Bắt đầu" value={formatDate(enrollment.started_at)} />
        </dl>

        {!enrollment.student ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Chưa hiển thị được tên học viên: RLS bảng <code>profiles</code> hiện chưa cho coach
            đọc profile học viên được assign. Cần bổ sung policy ở tầng DB (quản trị viên xử lý).
          </p>
        ) : null}
      </section>

      {/* Lộ trình học tập */}
      <RoadmapPanel
        enrollmentId={enrollment.id}
        roadmap={roadmaps[0] ?? null}
        items={roadmapItems}
        onChanged={load}
      />

      {/* Tạo weekly plan */}
      <WeeklyPlanComposer
        enrollmentId={enrollment.id}
        nextWeekNumber={nextWeekNumber}
        onCreated={load}
      />

      {/* Danh sách plan + task + review */}
      {plans.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          Chưa có weekly plan nào. Tạo plan đầu tiên để bắt đầu giao bài.
        </p>
      ) : (
        plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            tasks={tasksByPlan.get(plan.id) ?? []}
            submissionByTask={submissionByTask}
            revisionsBySubmission={revisionsBySubmission}
            onChanged={load}
          />
        ))
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-700">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Roadmap management (Slice 02)                                       */
/* ------------------------------------------------------------------ */

function RoadmapPanel({
  enrollmentId,
  roadmap,
  items,
  onChanged,
}: {
  enrollmentId: string;
  roadmap: Roadmap | null;
  items: RoadmapItem[];
  onChanged: () => Promise<void>;
}) {
  const ordered = [...items].sort((a, b) => a.sequence - b.sequence);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MapIcon className="h-4 w-4 text-emblue" />
        <h2 className="text-base font-semibold text-slate-800">Lộ trình học tập</h2>
      </div>

      {!roadmap ? (
        <CreateRoadmapCard enrollmentId={enrollmentId} onCreated={onChanged} />
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <RoadmapHeader roadmap={roadmap} onChanged={onChanged} />

          <div className="mt-4 space-y-2">
            {ordered.length === 0 ? (
              <p className="text-sm text-slate-400">
                Chưa có chặng nào. Thêm chặng đầu tiên cho lộ trình.
              </p>
            ) : (
              ordered.map((item) => (
                <RoadmapItemRow key={item.id} item={item} onChanged={onChanged} />
              ))
            )}
          </div>

          <RoadmapItemComposer
            roadmapId={roadmap.id}
            nextSequence={ordered.reduce((m, i) => Math.max(m, i.sequence), 0) + 1}
            onCreated={onChanged}
          />
        </div>
      )}
    </section>
  );
}

function CreateRoadmapCard({
  enrollmentId,
  onCreated,
}: {
  enrollmentId: string;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Vui lòng nhập tên lộ trình.');
      return;
    }
    setSaving(true);
    try {
      await createRoadmap({ enrollment_id: enrollmentId, title: title.trim() });
      setTitle('');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo lộ trình thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
    >
      <p className="text-sm text-slate-500">
        Học viên chưa có lộ trình. Tạo lộ trình để học viên thấy mình đang ở đâu.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} sm:max-w-xs`}
          placeholder="Ví dụ: Lộ trình TOEIC 450 → 600"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Tạo lộ trình
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function RoadmapHeader({
  roadmap,
  onChanged,
}: {
  roadmap: Roadmap;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(roadmap.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(roadmap.title);
  }, [roadmap.title]);

  const saveTitle = async () => {
    if (!title.trim()) {
      setError('Tên lộ trình không được để trống.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateRoadmap({ roadmap_id: roadmap.id, title: title.trim() });
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: RoadmapStatus) => {
    setError('');
    try {
      await updateRoadmap({ roadmap_id: roadmap.id, status });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClass} sm:max-w-sm`}
            />
            <button
              onClick={() => void saveTitle()}
              disabled={saving}
              className="rounded-lg bg-master px-3 py-2 text-sm font-semibold text-white hover:bg-master-dark disabled:opacity-60"
            >
              Lưu
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setTitle(roadmap.title);
                setError('');
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800">{roadmap.title}</p>
            <button
              onClick={() => setEditing(true)}
              title="Sửa tên lộ trình"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-emblue"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          Trạng thái
          <select
            value={roadmap.status}
            onChange={(e) => void changeStatus(e.target.value as RoadmapStatus)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emblue focus:ring-2 focus:ring-emblue/20"
          >
            {(Object.keys(ROADMAP_STATUS_LABEL) as RoadmapStatus[]).map((s) => (
              <option key={s} value={s}>
                {ROADMAP_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function RoadmapItemRow({
  item,
  onChanged,
}: {
  item: RoadmapItem;
  onChanged: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const changeStatus = async (status: RoadmapItemStatus) => {
    setUpdating(true);
    setError('');
    try {
      await updateRoadmapItem({ item_id: item.id, status });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
          {item.sequence}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <RoadmapItemBadge status={item.status} />
        <select
          value={item.status}
          disabled={updating}
          onChange={(e) => void changeStatus(e.target.value as RoadmapItemStatus)}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emblue focus:ring-2 focus:ring-emblue/20 disabled:opacity-60"
        >
          {ROADMAP_ITEM_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {ROADMAP_ITEM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function RoadmapItemComposer({
  roadmapId,
  nextSequence,
  onCreated,
}: {
  roadmapId: string;
  nextSequence: number;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<RoadmapItemStatus>('available');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Vui lòng nhập tên chặng.');
      return;
    }
    setSaving(true);
    try {
      await createRoadmapItem({
        roadmap_id: roadmapId,
        title: title.trim(),
        description: description.trim(),
        sequence: nextSequence,
        status,
      });
      setTitle('');
      setDescription('');
      setStatus('available');
      setOpen(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm chặng thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-emblue hover:text-emblue"
      >
        <Plus className="h-4 w-4" /> Thêm chặng
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Tên chặng</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Ví dụ: Nền tảng Listening Part 1–2"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Trạng thái</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RoadmapItemStatus)}
          className={inputClass}
        >
          {ROADMAP_ITEM_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {ROADMAP_ITEM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Mô tả</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </label>

      {error ? (
        <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white transition hover:bg-master-dark disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Lưu chặng
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly plan composer                                                */
/* ------------------------------------------------------------------ */

function WeeklyPlanComposer({
  enrollmentId,
  nextWeekNumber,
  onCreated,
}: {
  enrollmentId: string;
  nextWeekNumber: number;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [weekNumber, setWeekNumber] = useState(String(nextWeekNumber));
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [coachMessage, setCoachMessage] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setWeekNumber(String(nextWeekNumber));
  }, [nextWeekNumber]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề tuần.');
      return;
    }
    setSaving(true);
    try {
      await createWeeklyPlan({
        enrollment_id: enrollmentId,
        week_number: Number(weekNumber) || nextWeekNumber,
        title: title.trim(),
        focus: focus.trim(),
        coach_message: coachMessage.trim(),
        starts_on: startsOn || null,
        ends_on: endsOn || null,
      });
      setTitle('');
      setFocus('');
      setCoachMessage('');
      setStartsOn('');
      setEndsOn('');
      setOpen(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo weekly plan thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark"
      >
        <Plus className="h-4 w-4" /> Tạo weekly plan
      </button>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Weekly plan mới</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Tuần số</span>
          <input
            type="number"
            min={1}
            value={weekNumber}
            onChange={(e) => setWeekNumber(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Tiêu đề</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Ví dụ: Tuần 1 — Nền tảng Listening"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Trọng tâm</span>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className={inputClass}
            placeholder="Ví dụ: Part 1 & 2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Bắt đầu</span>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Kết thúc</span>
            <input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Lời nhắn cho học viên
          </span>
          <textarea
            value={coachMessage}
            onChange={(e) => setCoachMessage(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </label>

        {error ? (
          <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Lưu plan
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Hủy
          </button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Plan card + tasks                                                   */
/* ------------------------------------------------------------------ */

function PlanCard({
  plan,
  tasks,
  submissionByTask,
  revisionsBySubmission,
  onChanged,
}: {
  plan: WeeklyPlan;
  tasks: CoachingTask[];
  submissionByTask: Map<string, Submission>;
  revisionsBySubmission: Map<string, SubmissionRevision[]>;
  onChanged: () => Promise<void>;
}) {
  const nextSequence = tasks.reduce((m, t) => Math.max(m, t.sequence), 0) + 1;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Tuần {plan.week_number}: {plan.title}
          </h2>
          {plan.focus ? <p className="text-sm text-slate-500">Trọng tâm: {plan.focus}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
          {plan.status}
        </span>
      </div>

      {(plan.starts_on || plan.ends_on) && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(plan.starts_on)} – {formatDate(plan.ends_on)}
        </p>
      )}

      {plan.coach_message ? (
        <p className="mt-3 rounded-lg bg-emblue/5 p-3 text-sm text-slate-600">
          {plan.coach_message}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có task nào.</p>
        ) : (
          tasks.map((task) => {
            const sub = submissionByTask.get(task.id);
            return (
              <TaskRow
                key={task.id}
                task={task}
                submission={sub}
                revisions={sub ? revisionsBySubmission.get(sub.id) : undefined}
                onChanged={onChanged}
              />
            );
          })
        )}
      </div>

      <TaskComposer planId={plan.id} nextSequence={nextSequence} onCreated={onChanged} />
    </section>
  );
}

function TaskRow({
  task,
  submission,
  revisions,
  onChanged,
}: {
  task: CoachingTask;
  submission: Submission | undefined;
  revisions: SubmissionRevision[] | undefined;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">
            <span className="mr-2 text-xs text-slate-400">#{task.sequence}</span>
            {task.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {TASK_TYPE_LABEL[task.task_type as SliceTaskType] ?? task.task_type}
            {task.due_at ? ` • hạn ${formatDate(task.due_at)}` : ''}
            {task.is_required ? ' • bắt buộc' : ''}
          </p>
        </div>
        {submission ? <SubmissionBadge status={submission.status} /> : null}
      </div>

      {task.instructions ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.instructions}</p>
      ) : null}

      {submission ? (
        <ReviewPanel submission={submission} revisions={revisions ?? []} onChanged={onChanged} />
      ) : (
        <p className="mt-2 text-xs text-slate-400">Học viên chưa nộp.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Task composer                                                       */
/* ------------------------------------------------------------------ */

function TaskComposer({
  planId,
  nextSequence,
  onCreated,
}: {
  planId: string;
  nextSequence: number;
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [taskType, setTaskType] = useState<SliceTaskType>('text');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [required, setRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề task.');
      return;
    }
    setSaving(true);
    try {
      await createTask({
        weekly_plan_id: planId,
        task_type: taskType,
        title: title.trim(),
        instructions: instructions.trim(),
        sequence: nextSequence,
        due_at: dueAt || null,
        is_required: required,
      });
      setTitle('');
      setInstructions('');
      setDueAt('');
      setRequired(true);
      setOpen(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo task thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-emblue hover:text-emblue"
      >
        <Plus className="h-4 w-4" /> Thêm task
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Loại task</span>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as SliceTaskType)}
          className={inputClass}
        >
          {SLICE_TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {TASK_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Ví dụ: Ghi âm Part 1 - Questions 1-6"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Hướng dẫn</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Hạn nộp</span>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Bắt buộc
      </label>

      {error ? (
        <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-master px-4 py-2 text-sm font-semibold text-white transition hover:bg-master-dark disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Lưu task
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Review panel                                                        */
/* ------------------------------------------------------------------ */

function ReviewPanel({
  submission,
  revisions,
  onChanged,
}: {
  submission: Submission;
  revisions: SubmissionRevision[];
  onChanged: () => Promise<void>;
}) {
  const [feedbackText, setFeedbackText] = useState(submission.feedback_text ?? '');
  const [score, setScore] = useState(
    submission.feedback_score !== null ? String(submission.feedback_score) : ''
  );
  const [requestRevision, setRequestRevision] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (!feedbackText.trim()) {
      setError('Vui lòng nhập phản hồi cho học viên.');
      return;
    }
    setSaving(true);
    try {
      await reviewSubmission({
        submission_id: submission.id,
        feedback_text: feedbackText.trim(),
        feedback_score: score.trim() === '' ? null : Number(score),
        request_revision: requestRevision,
      });
      setDone(
        requestRevision ? 'Đã gửi yêu cầu chỉnh sửa.' : 'Đã chấm bài.'
      );
      setRequestRevision(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi phản hồi thất bại');
    } finally {
      setSaving(false);
    }
  };

  const hasFeedback =
    submission.feedback_text ||
    submission.feedback_score !== null ||
    submission.reviewed_at;

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      {/* Nội dung học viên nộp */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Bài nộp
        </p>
        {submission.text_response ? (
          <p className="whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-slate-700 ring-1 ring-slate-200">
            {submission.text_response}
          </p>
        ) : null}
        {submission.storage_path ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <AttachmentLink path={submission.storage_path} />
            {submission.duration_seconds !== null ? (
              <span className="text-xs text-slate-400">{submission.duration_seconds}s</span>
            ) : null}
          </div>
        ) : null}
        {!submission.text_response && !submission.storage_path ? (
          <p className="text-sm text-slate-400">
            {submission.status === 'draft'
              ? 'Học viên đang soạn nháp.'
              : 'Bài nộp dạng check-off (không có nội dung đính kèm).'}
          </p>
        ) : null}
        {submission.submitted_at ? (
          <p className="mt-1 text-xs text-slate-400">
            Nộp lúc {formatDateTime(submission.submitted_at)}
          </p>
        ) : null}
      </div>

      {/* Phản hồi trước đó */}
      {hasFeedback ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Phản hồi đã gửi
          </p>
          {submission.feedback_text ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">
              {submission.feedback_text}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-emerald-700">
            {submission.feedback_score !== null ? `Điểm: ${submission.feedback_score} • ` : ''}
            {submission.reviewed_at ? formatDateTime(submission.reviewed_at) : ''}
          </p>
        </div>
      ) : null}

      {/* Lịch sử các lần nộp trước (Migration 020) — chỉ hiện khi có nhiều hơn 1 phiên bản */}
      {revisions.length >= 2 ? (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <RevisionHistory
            revisions={revisions}
            title="Lịch sử các lần nộp"
            embedded
          />
        </div>
      ) : null}

      {/* Form review */}
      {submission.status === 'draft' ? (
        <p className="text-xs text-slate-400">
          Học viên chưa nộp — có thể chấm sau khi học viên nộp bài.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <MessageSquare className="h-3.5 w-3.5" /> Phản hồi của coach
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={2}
            placeholder="Nhận xét, hướng dẫn cải thiện..."
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Điểm (tùy chọn)
              <input
                type="number"
                step="any"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emblue focus:ring-2 focus:ring-emblue/20"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={requestRevision}
                onChange={(e) => setRequestRevision(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Yêu cầu làm lại
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {done ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-700">
              {done}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emblue px-4 py-2 text-sm font-semibold text-white transition hover:bg-emblue-dark disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Gửi phản hồi
          </button>
        </form>
      )}
    </div>
  );
}
