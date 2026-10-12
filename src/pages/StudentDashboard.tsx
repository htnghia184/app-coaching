import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Map as MapIcon,
  RotateCcw,
  Target,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  getActiveEnrollmentForStudent,
  listRoadmapItems,
  listRoadmaps,
  listSubmissionsForTasks,
  listTasksForPlans,
  listWeeklyPlans,
} from '../lib/coachingService';
import { formatDate, formatScore, personLabel } from '../lib/format';
import {
  getStudentTaskStatusLabel,
  getStudentTaskStatusVi,
} from '../lib/types';
import type {
  CoachingTask,
  EnrollmentWithPeople,
  Roadmap,
  RoadmapItem,
  Submission,
  WeeklyPlan,
} from '../lib/types';
import { RoadmapItemBadge, StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';

const TASK_TYPE_LABEL: Record<string, string> = {
  text: 'Trả lời văn bản',
  audio: 'Ghi âm',
  file: 'Tải tệp',
  checkoff: 'Xác nhận hoàn thành',
  lesson: 'Bài học',
  practice: 'Luyện tập',
  assessment: 'Kiểm tra',
};

type PrimaryAction =
  | { kind: 'revision'; task: CoachingTask }
  | { kind: 'do'; task: CoachingTask }
  | { kind: 'waiting'; task: CoachingTask }
  | { kind: 'done'; task: CoachingTask };

export function StudentDashboard() {
  const { profile } = useAuth();
  const [enrollment, setEnrollment] = useState<EnrollmentWithPeople | null>(null);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [tasks, setTasks] = useState<CoachingTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const en = await getActiveEnrollmentForStudent(profile.id);
      setEnrollment(en);
      if (!en) {
        setPlans([]);
        setTasks([]);
        setSubmissions([]);
        setRoadmaps([]);
        setRoadmapItems([]);
        return;
      }
      const plansData = await listWeeklyPlans(en.id);
      setPlans(plansData);
      const tasksData = await listTasksForPlans(plansData.map((p) => p.id));
      setTasks(tasksData);
      setSubmissions(await listSubmissionsForTasks(tasksData.map((t) => t.id)));
      const roadmapsData = await listRoadmaps(en.id);
      setRoadmaps(roadmapsData);
      setRoadmapItems(await listRoadmapItems(roadmapsData.map((r) => r.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const planById = useMemo(() => {
    const map = new Map<string, WeeklyPlan>();
    for (const p of plans) map.set(p.id, p);
    return map;
  }, [plans]);

  /** Thứ tự hiển thị/quyết định ưu tiên: theo tuần rồi theo sequence. */
  const orderedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const wa = planById.get(a.weekly_plan_id)?.week_number ?? 0;
      const wb = planById.get(b.weekly_plan_id)?.week_number ?? 0;
      if (wa !== wb) return wa - wb;
      return a.sequence - b.sequence;
    });
  }, [tasks, planById]);

  const submissionByTask = useMemo(() => {
    const map = new Map<string, Submission>();
    for (const s of submissions) map.set(s.task_id, s);
    return map;
  }, [submissions]);

  const currentPlan = useMemo(() => {
    if (plans.length === 0) return null;
    const active = plans.filter((p) => p.status === 'active');
    const pool = active.length > 0 ? active : plans;
    return pool.reduce((max, p) => (p.week_number > max.week_number ? p : max));
  }, [plans]);

  const currentPlanTasks = useMemo(() => {
    if (!currentPlan) return [];
    return tasks
      .filter((t) => t.weekly_plan_id === currentPlan.id)
      .sort((a, b) => a.sequence - b.sequence);
  }, [tasks, currentPlan]);

  /** Quyết định hành động chính (deterministic). */
  const primary = useMemo<PrimaryAction | null>(() => {
    const isActionable = (t: CoachingTask) => {
      const s = submissionByTask.get(t.id);
      return !s || s.status === 'draft';
    };
    const bySequence = (list: CoachingTask[]) => list[0];

    const revision = orderedTasks.find(
      (t) => submissionByTask.get(t.id)?.status === 'revision_requested'
    );
    if (revision) return { kind: 'revision', task: revision };

    if (currentPlan) {
      const currentActionable = orderedTasks.filter(
        (t) => t.weekly_plan_id === currentPlan.id && isActionable(t)
      );
      const requiredCurrent = currentActionable.filter((t) => t.is_required);
      const pick = bySequence(requiredCurrent) ?? bySequence(currentActionable);
      if (pick) return { kind: 'do', task: pick };
    }

    const nextIncomplete =
      orderedTasks.find((t) => t.is_required && isActionable(t)) ??
      orderedTasks.find(isActionable);
    if (nextIncomplete) return { kind: 'do', task: nextIncomplete };

    const waiting = orderedTasks.find(
      (t) => submissionByTask.get(t.id)?.status === 'submitted'
    );
    if (waiting) return { kind: 'waiting', task: waiting };

    const reviewed = orderedTasks.find(
      (t) => submissionByTask.get(t.id)?.status === 'reviewed'
    );
    if (reviewed) return { kind: 'done', task: reviewed };

    return null;
  }, [orderedTasks, submissionByTask, currentPlan]);

  /** Tiến độ bài bắt buộc (đã hoàn thành = submission.status = reviewed). */
  const taskProgress = useMemo(() => {
    const required = tasks.filter((t) => t.is_required);
    const done = required.filter(
      (t) => submissionByTask.get(t.id)?.status === 'reviewed'
    ).length;
    return { done, total: required.length };
  }, [tasks, submissionByTask]);

  const weekProgress = useMemo(() => {
    const required = currentPlanTasks.filter((t) => t.is_required);
    const done = required.filter(
      (t) => submissionByTask.get(t.id)?.status === 'reviewed'
    ).length;
    return { done, total: required.length };
  }, [currentPlanTasks, submissionByTask]);

  const roadmap = roadmaps[0] ?? null;
  const orderedRoadmapItems = useMemo(
    () => [...roadmapItems].sort((a, b) => a.sequence - b.sequence),
    [roadmapItems]
  );
  const roadmapProgress = useMemo(() => {
    const done = orderedRoadmapItems.filter((i) => i.status === 'completed').length;
    return { done, total: orderedRoadmapItems.length };
  }, [orderedRoadmapItems]);
  const currentStage = useMemo(() => {
    return (
      orderedRoadmapItems.find((i) => i.status === 'in_progress') ??
      orderedRoadmapItems.find((i) => i.status === 'available') ??
      orderedRoadmapItems.find(
        (i) => i.status !== 'completed' && i.status !== 'skipped'
      ) ??
      null
    );
  }, [orderedRoadmapItems]);

  if (loading) return <Spinner label="Đang tải chương trình học..." />;

  if (error) {
    return (
      <div className="page-container">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="page-container">
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-lg font-semibold text-master">
            Bạn chưa được gán chương trình Coaching
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Vui lòng liên hệ coach hoặc quản trị viên E-Master để được thiết lập lộ trình.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Greeting + Goal */}
      <GoalCard enrollment={enrollment} studentName={personLabel(profile)} />

      {/* PRIMARY ACTION */}
      <PrimaryActionCard
        primary={primary}
        planById={planById}
        submissionByTask={submissionByTask}
      />

      {/* THIS WEEK */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-800">Tuần này</h2>
          {currentPlan && (currentPlan.starts_on || currentPlan.ends_on) ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(currentPlan.starts_on)} – {formatDate(currentPlan.ends_on)}
            </span>
          ) : null}
        </div>

        {!currentPlan ? (
          <EmptyCard
            icon={<Calendar className="h-5 w-5" />}
            text="Coach chưa tạo kế hoạch tuần nào. Bạn sẽ thấy nhiệm vụ ngay khi coach giao bài."
          />
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-800">
              Tuần {currentPlan.week_number}: {currentPlan.title}
            </p>
            {currentPlan.focus ? (
              <p className="mt-0.5 text-sm text-slate-500">Trọng tâm: {currentPlan.focus}</p>
            ) : null}
            {currentPlan.coach_message ? (
              <p className="mt-3 rounded-xl bg-emblue/5 p-3 text-sm text-slate-600">
                {currentPlan.coach_message}
              </p>
            ) : null}

            {currentPlanTasks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Coach chưa giao nhiệm vụ cho tuần này.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {currentPlanTasks.map((task) => {
                  const sub = submissionByTask.get(task.id);
                  const label = getStudentTaskStatusLabel(sub);
                  return (
                    <li key={task.id}>
                      <Link
                        to={`/student/tasks/${task.id}`}
                        className="group flex items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            <span className="mr-2 text-xs text-slate-400">#{task.sequence}</span>
                            {task.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
                            {task.due_at ? ` • hạn ${formatDate(task.due_at)}` : ''}
                            {task.is_required ? ' • bắt buộc' : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge label={label} />
                          <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emblue" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ROADMAP */}
      <RoadmapSection
        roadmap={roadmap}
        items={orderedRoadmapItems}
        currentStageId={currentStage?.id ?? null}
      />

      {/* PROGRESS */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Tiến độ</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <ProgressCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Bài bắt buộc"
            done={taskProgress.done}
            total={taskProgress.total}
            unit=" bài hoàn thành"
          />
          <ProgressCard
            icon={<Calendar className="h-4 w-4" />}
            title="Tuần hiện tại"
            done={weekProgress.done}
            total={weekProgress.total}
            unit=" bài hoàn thành"
          />
          <ProgressCard
            icon={<MapIcon className="h-4 w-4" />}
            title="Lộ trình"
            done={roadmapProgress.done}
            total={roadmapProgress.total}
            unit=" chặng hoàn thành"
          />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Goal                                                                */
/* ------------------------------------------------------------------ */

function GoalCard({
  enrollment,
  studentName,
}: {
  enrollment: EnrollmentWithPeople;
  studentName: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex items-center gap-2 text-emblue">
        <Target className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wide">Mục tiêu của bạn</span>
      </div>
      <h1 className="mt-2 text-xl font-semibold text-master sm:text-2xl">
        {studentName}
      </h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {enrollment.program}
        {enrollment.goal_label ? ` — ${enrollment.goal_label}` : ''}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Stat label="Điểm đầu vào" value={formatScore(enrollment.baseline_data)} />
        <Stat label="Mục tiêu" value={formatScore(enrollment.target_data)} />
        <Stat label="Ngày mục tiêu" value={formatDate(enrollment.target_date)} />
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Coach</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-slate-700">
            <UserRound className="h-3.5 w-3.5 text-slate-400" />
            {enrollment.coach ? personLabel(enrollment.coach) : '—'}
          </dd>
        </div>
      </dl>
    </section>
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
/* Primary action                                                      */
/* ------------------------------------------------------------------ */

function PrimaryActionCard({
  primary,
  planById,
  submissionByTask,
}: {
  primary: PrimaryAction | null;
  planById: Map<string, WeeklyPlan>;
  submissionByTask: Map<string, Submission>;
}) {
  if (!primary) {
    return (
      <section className="rounded-2xl bg-master p-5 text-white shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Tiếp tục học
        </p>
        <p className="mt-2 text-lg font-semibold">Hiện chưa có nhiệm vụ nào</p>
        <p className="mt-1 text-sm text-white/70">
          Coach sẽ giao bài cho bạn trong kế hoạch tuần sớm nhất.
        </p>
      </section>
    );
  }

  const { task, kind } = primary;
  const plan = planById.get(task.weekly_plan_id) ?? null;
  const statusLabel = getStudentTaskStatusVi(submissionByTask.get(task.id));

  const context = [
    plan ? `Tuần ${plan.week_number}` : null,
    plan?.title || null,
    task.due_at ? `Hạn ${formatDate(task.due_at)}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const cta =
    kind === 'revision'
      ? { label: 'Tiếp tục chỉnh sửa', icon: <RotateCcw className="h-4 w-4" /> }
      : kind === 'done'
        ? { label: 'Xem phản hồi', icon: <CheckCircle2 className="h-4 w-4" /> }
        : { label: 'Làm bài', icon: <ArrowRight className="h-4 w-4" /> };

  return (
    <section className="rounded-2xl bg-master p-5 text-white shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Tiếp tục học
        </p>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
          {statusLabel}
        </span>
      </div>

      <h2 className="mt-3 text-lg font-semibold sm:text-xl">{task.title}</h2>
      {context ? <p className="mt-1 text-sm text-white/70">{context}</p> : null}

      {kind === 'waiting' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-white/80">
            <Clock className="h-4 w-4" /> Đang chờ coach chấm bài — bạn không cần làm lại lúc này.
          </span>
          <Link
            to={`/student/tasks/${task.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            Xem bài đã nộp
          </Link>
        </div>
      ) : (
        <Link
          to={`/student/tasks/${task.id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-master transition hover:bg-white/90"
        >
          {cta.icon}
          {cta.label}
        </Link>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

function RoadmapSection({
  roadmap,
  items,
  currentStageId,
}: {
  roadmap: Roadmap | null;
  items: RoadmapItem[];
  currentStageId: string | null;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MapIcon className="h-4 w-4 text-emblue" />
        <h2 className="text-base font-semibold text-slate-800">Lộ trình học tập</h2>
      </div>

      {!roadmap ? (
        <EmptyCard
          icon={<MapIcon className="h-5 w-5" />}
          text="Coach chưa thiết lập lộ trình cho bạn. Lộ trình sẽ xuất hiện ở đây khi được tạo."
        />
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="font-semibold text-slate-800">{roadmap.title}</p>

          {items.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Lộ trình chưa có chặng nào. Coach sẽ bổ sung các chặng tiếp theo.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {items.map((item, idx) => {
                const isCurrent = item.id === currentStageId;
                return (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      isCurrent
                        ? 'border-emblue/40 bg-emblue/5'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                        isCurrent ? 'bg-emblue text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.sequence || idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-800">{item.title}</p>
                        {isCurrent ? (
                          <span className="rounded-full bg-emblue/10 px-2 py-0.5 text-[11px] font-medium text-emblue-dark">
                            Hiện tại
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
                      ) : null}
                    </div>
                    <RoadmapItemBadge status={item.status} />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

function ProgressCard({
  icon,
  title,
  done,
  total,
  unit,
}: {
  icon: React.ReactNode;
  title: string;
  done: number;
  total: number;
  unit: string;
}) {
  if (total === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-emblue">{icon}</span>
          {title}
        </p>
        <p className="mt-3 text-sm text-slate-400">Chưa có dữ liệu.</p>
      </div>
    );
  }

  const pct = Math.round((done / total) * 100);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span className="text-emblue">{icon}</span>
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-master">{pct}%</p>
      <p className="text-xs text-slate-500">
        {done}/{total}
        {unit}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emblue transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
      <span className="mt-0.5 text-slate-300">{icon}</span>
      <p>{text}</p>
    </div>
  );
}
