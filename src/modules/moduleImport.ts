import { STAGES, validateModuleManifest, type ModuleManifest } from './ree';

/** Client-side preflight only. Never use this as a server-side publication gate. */
export function parseModuleDraft(raw: string): ModuleManifest {
  if (raw.length > 500_000) throw new Error('JSON vượt giới hạn 500 KB.');
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { throw new Error('JSON không hợp lệ.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Module phải là JSON object.');
  const v = value as Record<string, unknown>;
  // Explicit denylist, including nested private keys, before any preview or persistence.
  const forbidden = /^(correct|explanation|answerKey|answer_key|isCorrect|privateKey|gradingKey)$/i;
  const scan = (node: unknown, path: string, depth = 0): void => {
    if (depth > 40) throw new Error('JSON lồng quá sâu.');
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (forbidden.test(key)) throw new Error(`Không nhập đáp án riêng tư vào JSON công khai: ${path}.${key}`);
      scan(child, `${path}.${key}`, depth + 1);
    }
  };
  scan(value, 'module');
  const requiredStrings = ['id', 'key', 'title', 'level', 'skill', 'outcome', 'discoverPrompt'];
  for (const key of requiredStrings) if (typeof v[key] !== 'string' || !(v[key] as string).trim()) throw new Error(`Thiếu trường: ${key}`);
  if ((typeof v.version !== 'number' || !Number.isInteger(v.version)) || Number(v.version) < 1) throw new Error('version phải là số nguyên dương.');
  if ((typeof v.minutes !== 'number' || !Number.isFinite(v.minutes)) || Number(v.minutes) <= 0) throw new Error('minutes phải lớn hơn 0.');
  if (!Array.isArray(v.stages) || v.stages.join('|') !== STAGES.join('|')) throw new Error('Cần đủ sáu stages theo đúng thứ tự.');
  for (const key of ['source', 'stageMinutes', 'learn', 'practice', 'apply', 'reflect', 'verify', 'mastery']) {
    if (!v[key] || typeof v[key] !== 'object') throw new Error(`Thiếu cấu trúc: ${key}`);
  }
  for (const key of ['prerequisites', 'rubric', 'assets', 'missingAssets']) if (!Array.isArray(v[key])) throw new Error(`${key} phải là array.`);
  try {
    const errors = validateModuleManifest(value as ModuleManifest);
    if (errors.length) throw new Error(errors.join('; '));
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Cấu trúc module không khớp schema REE hiện tại.');
    throw error;
  }
  return value as ModuleManifest;
}
