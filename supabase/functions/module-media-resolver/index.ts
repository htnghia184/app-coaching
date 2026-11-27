// Review-only Edge Function. Private MODULE_MEDIA_MAP_JSON is keyed by
// moduleKey -> contentVersion -> assetRef -> media target.
// Never put the map or unlisted IDs in VITE_ variables or public manifests.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { allowedOrigin, configuredAsset, manifestHasAsset, type MediaMap } from './security.ts';

const baseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async request => {
  const origin = allowedOrigin(request.headers.get('Origin'), Deno.env.get('MODULE_MEDIA_ALLOWED_ORIGINS') ?? '');
  const headers = { ...baseHeaders, ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) };
  const fail = (status: number) => new Response(JSON.stringify({ error: 'Asset unavailable' }), { status, headers });
  if (request.headers.has('Origin') && !origin) return fail(403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return fail(405);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return fail(401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const rawMap = Deno.env.get('MODULE_MEDIA_MAP_JSON');
  if (!url || !key || !rawMap) return fail(503);
  const db = createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error } = await db.auth.getUser(auth.slice(7));
  if (error || !user) return fail(401);
  let input: { assetRef?: string; taskId?: string; moduleKey?: string; contentVersion?: number; draftPreview?: boolean };
  let assets: MediaMap;
  try {
    if (Number(request.headers.get('content-length') || 0) > 2048) return fail(413);
    input = await request.json();
    assets = JSON.parse(rawMap);
  } catch { return fail(400); }
  if (!input.assetRef || !/^private:[a-z0-9-]+:[a-z0-9-]+$/.test(input.assetRef)
    || !input.moduleKey || !Number.isInteger(input.contentVersion) || (input.contentVersion ?? 0) < 1) return fail(400);
  const asset = configuredAsset(assets, input.moduleKey, input.contentVersion!, input.assetRef);
  if (!asset) return fail(404);
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile) return fail(403);
  if (input.draftPreview && profile.role !== 'admin') return fail(403);
  if (input.draftPreview && input.taskId) return fail(400);
  if (!input.draftPreview && profile.role !== 'admin') {
    if (!input.taskId) return fail(403);
    const { data: assignment } = await db.from('coaching_generic_task_assignments').select('task_id,module_key,content_version').eq('task_id', input.taskId).maybeSingle();
    if (assignment?.module_key !== input.moduleKey || assignment.content_version !== input.contentVersion) return fail(403);
    const { data: task } = await db.from('coaching_tasks').select('id,module_id,weekly_plan_id').eq('id', input.taskId).maybeSingle();
    if (!task?.module_id) return fail(403);
    const { data: plan } = await db.from('coaching_weekly_plans').select('enrollment_id').eq('id', task.weekly_plan_id).maybeSingle();
    if (!plan) return fail(403);
    const { data: enrollment } = await db.from('coaching_enrollments').select('student_id,coach_id').eq('id', plan.enrollment_id).maybeSingle();
    if (!enrollment || (profile.role === 'student' && enrollment.student_id !== user.id)
      || (profile.role === 'teacher' && enrollment.coach_id !== user.id)
      || !['student','teacher'].includes(profile.role)) return fail(403);
    // The asset reference must belong to the assigned module's manifest. This
    // lookup stays under caller RLS; never use a service-role bypass here.
  }
  const table = input.draftPreview ? 'coaching_generic_module_drafts' : 'coaching_generic_module_versions';
  const { data: version } = await db.from(table).select('manifest').eq('module_key', input.moduleKey).eq('content_version', input.contentVersion).maybeSingle();
  if (!version || !manifestHasAsset(version.manifest, input.moduleKey, input.contentVersion!, input.assetRef, asset.kind)) return fail(403);
  if (asset.kind === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(asset.videoId)) {
    return new Response(JSON.stringify({ kind: 'youtube', url: `https://www.youtube-nocookie.com/embed/${asset.videoId}` }), { headers });
  }
  if (asset.kind === 'audio' && asset.bucket === Deno.env.get('MODULE_AUDIO_BUCKET') && asset.bucket !== 'exam-audio') {
    const { data, error: signError } = await db.storage.from(asset.bucket).createSignedUrl(asset.path, 300);
    if (!signError && data) return new Response(JSON.stringify({ kind: 'audio', url: data.signedUrl, expiresIn: 300 }), { headers });
  }
  return fail(404);
});
