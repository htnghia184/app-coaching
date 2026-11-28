import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, configuredAsset, manifestHasAsset } from '../supabase/functions/module-media-resolver/security.ts';

const map = { 'ielts-speaking-m01': { '2': { 'private:m01:video': { kind: 'youtube', videoId: 'abcdefghijk' } } } };
const manifest = { moduleId: 'ielts-speaking-m01', contentVersion: 2, stages: [{ activities: [
  { type: 'media', payload: { kind: 'youtube', assetRef: 'private:m01:video' } },
  { type: 'lesson', payload: { text: 'private:m01:other' } },
] }] };

test('CORS accepts only configured exact origins', () => {
  assert.equal(allowedOrigin('https://preview.example', 'https://preview.example,https://app.example'), 'https://preview.example');
  assert.equal(allowedOrigin('https://preview.example.evil', 'https://preview.example'), null);
  assert.equal(allowedOrigin('null', 'https://preview.example'), null);
});

test('asset authorization requires module, version, media activity and kind', () => {
  assert.ok(configuredAsset(map, 'ielts-speaking-m01', 2, 'private:m01:video'));
  assert.equal(configuredAsset(map, 'ielts-speaking-m01', 1, 'private:m01:video'), null);
  assert.equal(configuredAsset(map, 'ielts-speaking-m02', 2, 'private:m01:video'), null);
  assert.equal(manifestHasAsset(manifest, 'ielts-speaking-m01', 2, 'private:m01:video', 'youtube'), true);
  assert.equal(manifestHasAsset(manifest, 'ielts-speaking-m01', 1, 'private:m01:video', 'youtube'), false);
  assert.equal(manifestHasAsset(manifest, 'ielts-speaking-m02', 2, 'private:m01:video', 'youtube'), false);
  assert.equal(manifestHasAsset(manifest, 'ielts-speaking-m01', 2, 'private:m01:video', 'audio'), false);
  assert.equal(manifestHasAsset(manifest, 'ielts-speaking-m01', 2, 'private:m01:other', 'youtube'), false);
});
