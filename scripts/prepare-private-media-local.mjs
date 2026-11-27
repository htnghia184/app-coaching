// Writes only ignored local configuration; never print or commit media IDs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const source = process.env.PRIVATE_CONTENT_DIR;
assert.ok(source && fs.existsSync(path.join(source, 'README.md')));
const base = fs.readFileSync('.tmp/media-local.env', 'utf8');
const original = JSON.parse(base.match(/^MODULE_MEDIA_MAP_JSON=(.+)$/m)?.[1] ?? '{}');
const privateMap = JSON.parse(fs.readFileSync(path.join(source, 'private-media-review.json'), 'utf8'));
for (const [assetRef, asset] of Object.entries(privateMap.verifiedMapping)) {
  const moduleKey = `ielts-speaking-${assetRef.split(':')[1]}`;
  original[moduleKey] ??= {};
  original[moduleKey]['1'] ??= {};
  original[moduleKey]['1'][assetRef] = { kind: asset.kind, videoId: asset.videoId };
}
const updated = base.replace(/^MODULE_MEDIA_MAP_JSON=.+$/m, `MODULE_MEDIA_MAP_JSON=${JSON.stringify(original)}`);
assert.notEqual(updated, base);
fs.writeFileSync('.tmp/private-media-local.env', updated, { mode: 0o600 });
console.log('PASS ignored local media configuration prepared for three unpublished videos');
