import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reeManifest, STAGES, validateModuleManifest } from '../src/modules/ree.ts';

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
  assert.equal(reeManifest.assets.length, 0);
  assert.equal(reeManifest.missingAssets.length, 2);
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
