// DRAFT: deploy only to an isolated Supabase project after RLS tests.
// Authenticated admin-only import; does not publish or handle private answer keys.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const stages = ['Discover', 'Learn', 'Practice', 'Apply', 'Reflect', 'Verify'];
const forbidden = /^(correct|explanation|answerKey|answer_key|isCorrect|privateKey|gradingKey)$/i;
const errorResponse = (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers });
function validate(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Manifest must be an object');
  const v = value as Record<string, unknown>;
  const scan = (node: unknown, depth = 0): void => {
    if (depth > 40) throw Error('Manifest too deeply nested');
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (forbidden.test(key)) throw Error('Private answer keys must not be imported');
      scan(child, depth + 1);
    }
  };
  scan(v);
  for (const key of ['id', 'key', 'title', 'level', 'skill', 'outcome', 'discoverPrompt']) {
    if (typeof v[key] !== 'string' || !(v[key] as string).trim()) throw Error('Invalid ' + key);
  }
  if (typeof v.version !== 'number' || !Number.isSafeInteger(v.version) || v.version < 1) throw Error('Invalid version');
  if (typeof v.minutes !== 'number' || !Number.isFinite(v.minutes) || v.minutes <= 0) throw Error('Invalid minutes');
  if (!Array.isArray(v.stages) || JSON.stringify(v.stages) !== JSON.stringify(stages)) throw Error('Invalid stage order');
  if (!v.source || typeof v.source !== 'object' || typeof (v.source as Record<string, unknown>).url !== 'string') throw Error('Invalid source');
  if (!v.stageMinutes || typeof v.stageMinutes !== 'object') throw Error('Invalid stageMinutes');
  for (const stage of stages) {
    const n = (v.stageMinutes as Record<string, unknown>)[stage];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw Error('Invalid stage duration: ' + stage);
  }
  for (const key of ['learn', 'practice', 'apply', 'reflect', 'verify', 'mastery']) {
    if (!v[key] || typeof v[key] !== 'object' || Array.isArray(v[key])) throw Error('Invalid ' + key);
  }
  for (const key of ['prerequisites', 'rubric', 'assets', 'missingAssets']) if (!Array.isArray(v[key])) throw Error('Invalid ' + key);
  if ((v.verify as Record<string, unknown>).prompt !== v.discoverPrompt) throw Error('Verify prompt must match Discover');
  if (JSON.stringify(v).length > 500000) throw Error('Manifest exceeds 500 KB');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return errorResponse('Authentication required', 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) return errorResponse('Server not configured', 503);
  // Use caller JWT for both profile lookup and insert so RLS remains authoritative.
  const db = createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await db.auth.getUser(auth.slice(7));
  if (authError || !user) return errorResponse('Unauthorized', 401);
  const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return errorResponse('Admin only', 403);
  let manifest: Record<string, unknown>;
  try {
    const body = await request.text();
    if (body.length > 500000) return errorResponse('Payload too large', 413);
    const parsed: unknown = JSON.parse(body);
    validate(parsed);
    manifest = parsed;
  } catch (e) { return errorResponse(e instanceof Error ? e.message : 'Invalid JSON'); }
  const { data, error } = await db.from('ielts_module_drafts').insert({
    module_key: manifest.key, content_version: manifest.version,
    title: manifest.title, manifest, created_by: user.id,
  }).select('id,module_key,content_version,created_at').single();
  if (error) return errorResponse(error.code === '23505' ? 'Draft version already exists' : 'Draft import failed', error.code === '23505' ? 409 : 400);
  return new Response(JSON.stringify({ draft: data }), { status: 201, headers });
});
