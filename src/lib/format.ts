import type { ProfileRef, ScoreData } from './types';

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Hiển thị điểm từ JSONB (baseline_data / target_data) một cách an toàn. */
export function formatScore(data: ScoreData | null | undefined): string {
  if (!data) return '—';
  const overall = data.overall;
  if (overall === undefined || overall === null || overall === '') return '—';
  return String(overall);
}

export function personLabel(
  ref: Pick<ProfileRef, 'full_name' | 'email'> | null | undefined
): string {
  if (!ref) return '—';
  if (ref.full_name && ref.full_name.trim()) return ref.full_name.trim();
  if (ref.email) return ref.email;
  return '—';
}

/**
 * Nhãn học viên cho Coach.
 * Lưu ý: RLS `profiles` hiện chưa cho coach đọc profile học viên được assign,
 * nên embed `student` có thể null — khi đó hiển thị mã rút gọn thay vì bịa tên.
 */
export function learnerLabel(
  student: Pick<ProfileRef, 'full_name' | 'email'> | null | undefined,
  studentId: string
): string {
  if (student && (student.full_name?.trim() || student.email)) {
    return personLabel(student);
  }
  return `Học viên ${studentId.slice(0, 8)}`;
}

export function initialOf(label: string): string {
  const ch = label.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}
