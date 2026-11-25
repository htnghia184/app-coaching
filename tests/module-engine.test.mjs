import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reeManifest, STAGES, validateModuleManifest } from '../src/modules/ree.ts';
import { latestCurrentRecording, latestRecording } from '../src/modules/history.ts';
import { meetsReeMastery, reviewRecording } from '../src/modules/reviewEvidence.ts';
import { persistRecording } from '../src/modules/recordingSave.ts';
import { validReeActivityResponse } from '../src/modules/activityValidation.ts';
import { coachingStoragePath } from '../src/lib/coachingStoragePath.ts';
import { readFileSync } from 'node:fs';

test('REE manifest matches source structure and has no leaked keys', () => {
  assert.deepEqual(validateModuleManifest(reeManifest), []);
  assert.deepEqual([...STAGES], ['Discover', 'Learn', 'Practice', 'Apply', 'Reflect', 'Verify']);
  assert.equal(reeManifest.practice.mcq.questions.length, 6);
  assert.equal(reeManifest.practice.matching.responds.length, 4);
  assert.equal(reeManifest.apply.prompts.length, 3);
  assert.equal(reeManifest.reflect.items.length, 5);
  assert.equal(reeManifest.discoverPrompt, reeManifest.verify.prompt);
  assert.deepEqual(reeManifest.mastery, {
    minimumScore: 6, noZero: true, minSeconds: 20, maxSeconds: 30,
  });
  assert.equal(reeManifest.assets.length, 1);
  assert.equal(reeManifest.assets[0].id, 'ielts-s-p1-m02');
  assert.equal(reeManifest.assets[0].stage, 'Learn');
  assert.equal(reeManifest.assets[0].verified, false);
  assert.equal(reeManifest.missingAssets.length, 0);
  const publicPayload = JSON.stringify(reeManifest);
  assert.doesNotMatch(publicPayload, /"correct"\s*:|"explanation"\s*:|"answerKey"\s*:/);
});

test('manifest validator rejects a video in Discover and missing provenance', () => {
  const changed = structuredClone(reeManifest);
  changed.assets.push({
    id: 'bad-video', stage: 'Discover', kind: 'video',
    url: 'https://example.invalid/video.mp4', verified: true,
  });
  changed.source.url = '';
  const errors = validateModuleManifest(changed);
  assert.ok(errors.includes('Video lessons belong in Learn only'));
  assert.ok(errors.includes('Missing identity or source'));
});

test('Verify retry cannot reuse a prior attempt recording', () => {
  const recordings = [
    { id: 'old', attempt_id: 'attempt-1', prompt_id: 'verify', storage_path: 'old.webm' },
    { id: 'baseline', attempt_id: 'attempt-1', prompt_id: 'discover', storage_path: 'baseline.webm' },
  ];
  assert.equal(latestRecording(recordings, 'discover')?.id, 'baseline');
  assert.equal(latestCurrentRecording(recordings, 'verify', 'attempt-2'), undefined);
  recordings.push({ id: 'new', attempt_id: 'attempt-2', prompt_id: 'verify', storage_path: 'new.webm' });
  assert.equal(latestCurrentRecording(recordings, 'verify', 'attempt-2')?.id, 'new');
});

test('coach evidence is pinned to the reviewed attempt and its declared inherited source', () => {
  const item = (id, attempt_id, prompt_id) => ({ id, attempt_id, prompt_id });
  const current = [item('current-verify','attempt-3','verify')];
  const inherited = [item('original-discover','attempt-1','discover'),
    item('original-verify','attempt-1','verify'), item('foreign','attempt-2','apply-1')];
  assert.equal(reviewRecording('attempt-3','attempt-1',current,inherited,'verify')?.recording.id, 'current-verify');
  assert.equal(reviewRecording('attempt-3','attempt-1',current,inherited,'discover')?.recording.id, 'original-discover');
  assert.equal(reviewRecording('attempt-3','attempt-1',current,inherited,'apply-1'), null);
  assert.equal(reviewRecording('attempt-3','attempt-1',[],inherited,'verify'), null);
});

test('mastery boundary: score, zero criterion, duration and coach revision', () => {
  const six = { respond: 1, explain: 1, example: 2, coherence: 2 };
  assert.equal(meetsReeMastery(six,20,false), true);
  assert.equal(meetsReeMastery(six,30,false), true);
  assert.equal(meetsReeMastery(six,19,false), false);
  assert.equal(meetsReeMastery(six,31,false), false);
  assert.equal(meetsReeMastery({ respond: 1, explain: 1, example: 1, coherence: 2 },25,false), false);
  assert.equal(meetsReeMastery({ respond: 0, explain: 2, example: 2, coherence: 2 },25,false), false);
  assert.equal(meetsReeMastery(six,25,true), false);
  assert.equal(meetsReeMastery({ ...six, coherence: undefined },25,false), false);
});

test('recording retry reuses an uploaded path after metadata failure', async () => {
  let uploads = 0;
  let pending = null;
  let saves = 0;
  const upload = async () => { uploads++; return 'student/task/file.webm'; };
  const save = async () => { if (++saves === 1) throw new Error('network'); };
  await assert.rejects(persistRecording(pending,upload,save,(path) => { pending = path; }),/network/);
  assert.equal(pending,'student/task/file.webm');
  await persistRecording(pending,upload,save,(path) => { pending = path; });
  assert.equal(uploads,1);
  assert.equal(saves,2);
});

test('failed upload does not create recording metadata', async () => {
  let saves = 0;
  await assert.rejects(persistRecording(null,async () => { throw new Error('upload'); },
    async () => { saves++; }, () => {}),/upload/);
  assert.equal(saves,0);
});

test('SQL proposal pins private keys to version and restricts evidence mutation', () => {
  const sql = readFileSync(new URL('../docs/proposed/ielts_module_engine.sql', import.meta.url),'utf8');
  assert.match(sql,/primary key \(module_id, content_version, activity_id\)/);
  assert.match(sql,/where module_id = v_attempt\.module_id and content_version = v_attempt\.content_version/);
  assert.match(sql,/inherited_evidence_attempt_id uuid references public\.coaching_module_attempts/);
  assert.match(sql,/coaching_private\.valid_ree_response\(p_activity_id,p_response\)/);
  assert.match(sql,/on storage\.objects as restrictive for update/);
  assert.match(sql,/on storage\.objects as restrictive for delete/);
  assert.match(sql,/v_attempt\.task_id::text \|\| '\/' \|\| p_attempt_id::text/);
});

test('module audio path is attempt-scoped while legacy uploads keep their path', () => {
  assert.equal(coachingStoragePath('student','task','file.webm','attempt'),
    'student/task/attempt/file.webm');
  assert.equal(coachingStoragePath('student','task','file.pdf'), 'student/task/file.pdf');
});

test('Practice accepts complete allowed choices without exposing correct answers', () => {
  const mcq = Object.fromEntries(Array.from({ length: 6 }, (_, index) =>
    [String(index + 1), { choice: 'A', stage: 'Explain' }]));
  const matching = Object.fromEntries(['A','B','C','D'].map((explain,index) =>
    [String(index + 1), { explain, example: ['i','ii','iii','iv'][index] }]));
  assert.equal(validReeActivityResponse('ree-mcq',mcq), true);
  assert.equal(validReeActivityResponse('ree-matching',matching), true);
  assert.equal(validReeActivityResponse('ree-unknown',mcq), false);
});

test('Practice rejects missing, extra and invalid options and duplicate matches', () => {
  const mcq = Object.fromEntries(Array.from({ length: 6 }, (_, index) =>
    [String(index + 1), { choice: 'A', stage: 'Explain' }]));
  assert.equal(validReeActivityResponse('ree-mcq',{ ...mcq, 6: undefined }), false);
  assert.equal(validReeActivityResponse('ree-mcq',{ ...mcq, 7: { choice: 'A', stage: 'Explain' } }), false);
  assert.equal(validReeActivityResponse('ree-mcq',{ ...mcq, 1: { choice: 'Z', stage: 'Explain' } }), false);
  assert.equal(validReeActivityResponse('ree-mcq',{ ...mcq, 1: { choice: 'A', stage: 'Explain', extra: true } }), false);
  const duplicate = Object.fromEntries(Array.from({ length: 4 }, (_, index) =>
    [String(index + 1), { explain: 'A', example: 'i' }]));
  assert.equal(validReeActivityResponse('ree-matching',duplicate), false);
});
