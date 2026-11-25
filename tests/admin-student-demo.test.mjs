import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const demo = readFileSync(new URL('../src/pages/AdminStudentDemo.tsx', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../src/pages/AdminModules.tsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('admin demo route stays behind admin role and is linked after preview', () => {
  assert.match(routes, /RequireRole role="admin"/);
  assert.match(routes, /path="\/admin\/modules\/demo"/);
  assert.match(admin, /to="\/admin\/modules\/demo"/);
  assert.match(admin, /importPreview\.id === REE_MODULE_ID/);
});

test('demo has six-stage navigation, practice, reflect and isolated audio', () => {
  assert.match(demo, /STAGES\.map/);
  for (const stage of ['Discover', 'Learn', 'Practice', 'Apply', 'Reflect', 'Verify']) {
    assert.ok(demo.includes("stage === '" + stage + "'"), stage);
  }
  assert.match(demo, /InteractionRegistry/);
  assert.match(demo, /validReeActivityResponse/);
  assert.match(demo, /MediaRecorder/);
  assert.match(demo, /URL\.revokeObjectURL/);
  assert.match(demo, /getUserMedia/);
});

test('demo has no production backend write dependencies or fake scoring', () => {
  assert.doesNotMatch(demo, /from ['"][^'"]*(coachingService|moduleService|supabase|AudioPrompt)/i);
  assert.doesNotMatch(demo, /\.from\(|\.rpc\(|\.upload\(|fetch\(/);
  assert.match(demo, /không chấm điểm thật/);
  assert.match(demo, /KHÔNG LƯU DỮ LIỆU/);
});
