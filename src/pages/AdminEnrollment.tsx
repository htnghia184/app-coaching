import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import {
  createEnrollment,
  listAllEnrollments,
  listProfilesByRole,
} from '../lib/coachingService';
import { formatDate, personLabel } from '../lib/format';
import type { EnrollmentWithPeople, ProfileRef, ScoreData } from '../lib/types';
import { Spinner } from '../components/Spinner';

const PROGRAM_SUGGESTIONS = ['TOEIC', 'IELTS', 'VSTEP', 'General English', 'Foundation'];

/** Bọc điểm overall vào JSONB vì ngữ nghĩa điểm khác nhau theo chương trình. */
function parseOverall(value: string): ScoreData {
  const v = value.trim();
  if (!v) return {};
  const n = Number(v);
  return Number.isFinite(n) ? { overall: n } : { overall: v };
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  paused: 'bg-amber-50 text-amber-700 ring-amber-200',
  completed: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
};

export function AdminEnrollment() {
  const [students, setStudents] = useState<ProfileRef[]>([]);
  const [teachers, setTeachers] = useState<ProfileRef[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithPeople[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [studentId, setStudentId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [program, setProgram] = useState('TOEIC');
  const [goalLabel, setGoalLabel] = useState('');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [s, t, e] = await Promise.all([
        listProfilesByRole('student'),
        listProfilesByRole('teacher'),
        listAllEnrollments(),
      ]);
      setStudents(s);
      setTeachers(t);
      setEnrollments(e);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccess('');

    if (!studentId || !coachId) {
      setFormError('Vui lòng chọn học viên và coach.');
      return;
    }
    if (studentId === coachId) {
      setFormError('Học viên và coach không thể là cùng một người.');
      return;
    }
    if (!program.trim()) {
      setFormError('Vui lòng nhập chương trình học.');
      return;
    }

    setSaving(true);
    try {
      await createEnrollment({
        student_id: studentId,
        coach_id: coachId,
        program: program.trim(),
        goal_label: goalLabel.trim(),
        baseline_data: parseOverall(baseline),
        target_data: parseOverall(target),
        target_date: targetDate || null,
      });
      setSuccess('Đã tạo Coaching enrollment.');
      setGoalLabel('');
      setBaseline('');
      setTarget('');
      setTargetDate('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tạo enrollment thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Đang tải dữ liệu enrollment..." />;

  return (
    <div className="page-container space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-master sm:text-2xl">
          Thiết lập Coaching
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gán học viên với coach và thiết lập mục tiêu ban đầu.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-800">
          Enrollment mới
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Học viên">
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Chọn học viên —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {personLabel(s)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Coach">
            <select
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Chọn coach —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {personLabel(t)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Chương trình">
            <input
              list="program-options"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className={inputClass}
              placeholder="TOEIC, IELTS, VSTEP..."
            />
            <datalist id="program-options">
              {PROGRAM_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>

          <Field label="Mục tiêu (goal)">
            <input
              value={goalLabel}
              onChange={(e) => setGoalLabel(e.target.value)}
              className={inputClass}
              placeholder="Ví dụ: TOEIC 600+"
            />
          </Field>

          <Field label="Baseline (điểm hiện tại)">
            <input
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              className={inputClass}
              placeholder="Ví dụ: 445"
            />
          </Field>

          <Field label="Target (điểm mục tiêu)">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={inputClass}
              placeholder="Ví dụ: 600"
            />
          </Field>

          <Field label="Ngày mục tiêu">
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-master py-2.5 text-sm font-semibold text-white transition hover:bg-master-dark disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Tạo enrollment
            </button>
          </div>

          {formError ? (
            <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          {success ? (
            <p className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">
          Enrollment hiện có ({enrollments.length})
        </h2>
        {enrollments.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            Chưa có enrollment nào.
          </p>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((en) => (
              <li
                key={en.id}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {en.student ? personLabel(en.student) : `Học viên ${en.student_id.slice(0, 8)}`}
                    <span className="mx-2 text-slate-300">→</span>
                    <span className="text-slate-500">
                      {en.coach ? personLabel(en.coach) : `Coach ${en.coach_id.slice(0, 8)}`}
                    </span>
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      STATUS_STYLE[en.status] ?? STATUS_STYLE.completed
                    }`}
                  >
                    {en.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {en.program}
                  {en.goal_label ? ` • ${en.goal_label}` : ''}
                  {en.target_date ? ` • mục tiêu ${formatDate(en.target_date)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-emblue focus:ring-2 focus:ring-emblue/20';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
