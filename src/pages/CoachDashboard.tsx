import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  listEnrollmentsForCoach,
  listRoadmapsForEnrollments,
  listSubmissionsForTasks,
  listTasksForPlans,
  listWeeklyPlansForEnrollments,
} from '../lib/coachingService';
import { formatDate, learnerLabel } from '../lib/format';
import type {
  CoachingTask,
  EnrollmentWithPeople,
  Submission,
  WeeklyPlan,
} from '../lib/types';
import { Spinner } from '../components/Spinner';

interface LearnerStats {
  pendingReview: number;
  revisionRequested: number;
  incompleteRequired: number;
  overdueRequired: number;
}

interface AttentionReason {
  tier: number;
  label: string;
}

interface LearnerSummary {
  enrollment: EnrollmentWithPeople;
  stats: LearnerStats;
  currentWeek: number | null;
  hasActivePlan: boolean;
  hasRoadmap: boolean;
  reasons: AttentionReason[];
  topTier: number;
}

export function CoachDashboard() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithPeople[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [tasks, setTasks] = useState<CoachingTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [roadmapEnrollmentIds, setRoadmapEnrollmentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const ens = await listEnrollmentsForCoach(profile.id);
      setEnrollments(ens);
      const enrollmentIds = ens.map((e) => e.id);

      // Batch query — không N+1 theo từng học viên.
      const plansData = await listWeeklyPlansForEnrollments(enrollmentIds);
      const tasksData = await listTasksForPlans(plansData.map((p) => p.id));
      const subsData = await listSubmissionsForTasks(tasksData.map((t) => t.id));
      const roadmapsData = await listRoadmapsForEnrollments(enrollmentIds);

      setPlans(plansData);
      setTasks(tasksData);
      setSubmissions(subsData);
      setRoadmapEnrollmentIds(new Set(roadmapsData.map((r) => r.enrollment_id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách học viên');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaries = useMemo<LearnerSummary[]>(() => {
    const enrollmentByPlan = new Map<string, string>();
    for (const p of plans) enrollmentByPlan.set(p.id, p.enrollment_id);

    const tasksByEnrollment = new Map<string, CoachingTask[]>();
    for (const t of tasks) {
      const enId = enrollmentByPlan.get(t.weekly_plan_id);
      if (!enId) continue;
      const list = tasksByEnrollment.get(enId) ?? [];
      list.push(t);
      tasksByEnrollment.set(enId, list);
    }

    const submissionByTask = new Map<string, Submission>();
    for (const s of submissions) submissionByTask.set(s.task_id, s);

    const now = Date.now();

    return enrollments.map((en) => {
      const enPlans = plans.filter((p) => p.enrollment_id === en.id);
      const enTasks = tasksByEnrollment.get(en.id) ?? [];
      const currentWeek =
        enPlans.length > 0 ? Math.max(...enPlans.map((p) => p.week_number)) : null;
      const hasActivePlan = enPlans.some((p) => p.status === 'active');

      let pendingReview = 0;
      let revisionRequested = 0;
      let incompleteRequired = 0;
      let overdueRequired = 0;

      for (const t of enTasks) {
        const sub = submissionByTask.get(t.id);
        if (sub?.status === 'submitted') pendingReview++;
        if (sub?.status === 'revision_requested') revisionRequested++;
        const isIncomplete = !sub || sub.status === 'draft';
        if (t.is_required && isIncomplete) {
          incompleteRequired++;
          if (t.due_at && new Date(t.due_at).getTime() < now) overdueRequired++;
        }
      }

      const stats: LearnerStats = {
        pendingReview,
        revisionRequested,
        incompleteRequired,
        overdueRequired,
      };

      const reasons: AttentionReason[] = [];
      if (pendingReview > 0) {
        reasons.push({ tier: 1, label: `${pendingReview} bài đang chờ chấm` });
      }
      if (overdueRequired > 0) {
        reasons.push({ tier: 2, label: `${overdueRequired} bài quá hạn cần xử lý` });
      }
      if (revisionRequested > 0) {
        reasons.push({ tier: 3, label: `Đang chờ học viên sửa (${revisionRequested})` });
      }
      if (enPlans.length === 0 || !hasActivePlan) {
        reasons.push({ tier: 4, label: 'Chưa có kế hoạch tuần' });
      }
      if (reasons.length === 0) {
        reasons.push({ tier: 5, label: 'Không có việc cần xử lý' });
      }
      reasons.sort((a, b) => a.tier - b.tier);

      return {
        enrollment: en,
        stats,
        currentWeek,
        hasActivePlan,
        hasRoadmap: roadmapEnrollmentIds.has(en.id),
        reasons,
        topTier: reasons[0].tier,
      };
    });
  }, [enrollments, plans, tasks, submissions, roadmapEnrollmentIds]);

  const attention = useMemo(() => {
    return summaries
      .filter((s) => s.topTier < 5)
      .sort((a, b) => {
        if (a.topTier !== b.topTier) return a.topTier - b.topTier;
        const nameA = learnerLabel(a.enrollment.student, a.enrollment.student_id);
        const nameB = learnerLabel(b.enrollment.student, b.enrollment.student_id);
        return nameA.localeCompare(nameB);
      });
  }, [summaries]);

  const overview = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const nameA = learnerLabel(a.enrollment.student, a.enrollment.student_id);
      const nameB = learnerLabel(b.enrollment.student, b.enrollment.student_id);
      return nameA.localeCompare(nameB);
    });
  }, [summaries]);

  if (loading) return <Spinner label="Đang tải học viên..." />;

  return (
    <div className="page-container space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emblue/10 text-emblue">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-master sm:text-2xl">Bảng điều khiển Coach</h1>
          <p className="text-sm text-slate-500">
            {enrollments.length} học viên được phân công
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {enrollments.length === 0 && !error ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">
            Bạn chưa được phân công học viên nào. Liên hệ quản trị viên E-Master.
          </p>
        </div>
      ) : null}

      {/* NEEDS ATTENTION */}
      {enrollments.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-800">Cần chú ý</h2>
          </div>

          {attention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p>Tất cả học viên đang trong tiến độ — không có việc nào cần xử lý ngay.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {attention.map((s) => (
                <li key={s.enrollment.id}>
                  <Link
                    to={`/coach/workspace/${s.enrollment.id}`}
                    className="group flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-emblue/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {learnerLabel(s.enrollment.student, s.enrollment.student_id)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {s.reasons
                          .filter((r) => r.tier < 5)
                          .map((r) => (
                            <span
                              key={r.tier}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                                r.tier === 1
                                  ? 'bg-sky-50 text-sky-700 ring-sky-200'
                                  : r.tier === 2
                                    ? 'bg-red-50 text-red-700 ring-red-200'
                                    : r.tier === 3
                                      ? 'bg-orange-50 text-orange-700 ring-orange-200'
                                      : 'bg-amber-50 text-amber-700 ring-amber-200'
                              }`}
                            >
                              {r.label}
                            </span>
                          ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emblue" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* ASSIGNED LEARNERS */}
      {enrollments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800">Học viên được phân công</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {overview.map((s) => (
              <LearnerCard key={s.enrollment.id} summary={s} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LearnerCard({ summary }: { summary: LearnerSummary }) {
  const { enrollment, stats, currentWeek, hasRoadmap } = summary;

  return (
    <Link
      to={`/coach/workspace/${enrollment.id}`}
      className="group flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-emblue/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">
            {learnerLabel(enrollment.student, enrollment.student_id)}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {enrollment.program}
            {enrollment.goal_label ? ` • ${enrollment.goal_label}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {currentWeek ? `Tuần ${currentWeek}` : 'Chưa có tuần'}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Chờ chấm" value={stats.pendingReview} />
        <Stat icon={<RotateCcw className="h-3.5 w-3.5" />} label="Chờ sửa" value={stats.revisionRequested} />
        <Stat
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Chưa xong"
          value={stats.incompleteRequired}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          Mục tiêu: {formatDate(enrollment.target_date)}
          {!hasRoadmap ? ' • chưa có lộ trình' : ''}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-emblue">
          Mở workspace
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 py-2.5">
      <dt className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold text-master">{value}</dd>
    </div>
  );
}
