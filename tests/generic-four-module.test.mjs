import test from 'node:test';
import assert from 'node:assert/strict';
import { fourModulePreviews } from '../src/modules/fourModulePreviews.ts';
import { parsePublicModule, evaluateVerify, activityResponse } from '../src/modules/genericEngine.ts';

test('four source-shaped previews parse and cover all eight activity families', () => {
  assert.equal(fourModulePreviews.length, 4);
  const types = new Set(fourModulePreviews.flatMap(m => m.stages.flatMap(s => s.activities.map(a => a.type))));
  assert.deepEqual(types, new Set(['lesson','media','choice','matching','text_response','recording','reflection','evidence_submit']));
  assert.ok(fourModulePreviews.every(m => parsePublicModule(m) === m));
  assert.ok(fourModulePreviews.every(m => m.stages.map(s => s.id).join(',') === 'Discover,Learn,Practice,Apply,Reflect,Verify'));
  assert.match(fourModulePreviews[3].outcomeStatement, /WHO, WHAT AND WHEN/);
  assert.equal(fourModulePreviews[3].stages[0].activities.some(a => a.type === 'recording'), false);
});

test('synthetic module links are versioned many-to-many and objective stays separate', () => {
  assert.equal(fourModulePreviews[0].outcomes.length, 2);
  assert.equal(fourModulePreviews.filter(m => m.outcomes.some(ref => ref.id === 'speaking-ree' && ref.version === 1)).length, 2);
  assert.ok(fourModulePreviews[0].outcomeStatement);
  const unlinked = structuredClone(fourModulePreviews[0]); unlinked.outcomes = [];
  assert.equal(parsePublicModule(unlinked).outcomes.length, 0);
  const duplicate = structuredClone(fourModulePreviews[0]); duplicate.outcomes.push(duplicate.outcomes[0]);
  assert.throws(() => parsePublicModule(duplicate), /unique/);
  const legacy = structuredClone(fourModulePreviews[0]); legacy.schemaVersion = 1; legacy.outcomeIds = ['provisional-only']; delete legacy.outcomes;
  assert.deepEqual(parsePublicModule(legacy).outcomes, [], 'legacy provisional ID does not become approved mapping');
});

test('structural source counts and Verify differences remain visible', () => {
  const recordingCounts = fourModulePreviews.map(m => m.stages.flatMap(s => s.activities.filter(a => a.type === 'recording')).reduce((n,a) => n + a.payload.prompts.length, 0));
  assert.deepEqual(recordingCounts, [5,7,5,7]);
  assert.equal(fourModulePreviews[1].verifyPolicy.kind, 'per_item_pass');
  assert.deepEqual(fourModulePreviews.filter((_,i) => i !== 1).map(m => m.verifyPolicy.kind), ['rubric_sum','rubric_sum','rubric_sum']);
  assert.equal(fourModulePreviews[1].stages[5].activities.some(a => a.type === 'recording'), false);
});

test('strict parser rejects unexpected properties, keys, active content and broken references', () => {
  const base = structuredClone(fourModulePreviews[0]);
  assert.throws(() => parsePublicModule({ ...base, answerKey: 'private' }));
  const leaked = structuredClone(base); leaked.stages[0].activities[0].payload.correct = 'a';
  assert.throws(() => parsePublicModule(leaked));
  const injected = structuredClone(base); injected.title = '<script>alert(1)</script>';
  assert.throws(() => parsePublicModule(injected));
  const duplicate = structuredClone(base); duplicate.stages[1].activities[0].id = duplicate.stages[0].activities[0].id;
  assert.throws(() => parsePublicModule(duplicate));
  const broken = structuredClone(base); broken.stages[5].activities[1].payload.evidenceItemIds = ['missing-recording'];
  assert.throws(() => parsePublicModule(broken));
});

test('module policy simulation separates completion from coach mastery', () => {
  const rubric = fourModulePreviews[0].verifyPolicy;
  assert.equal(evaluateVerify(rubric, { scores: [2,2,2,2], freshRecording: false }), false);
  assert.equal(evaluateVerify(rubric, { scores: [2,2,2,0], freshRecording: true }), false);
  assert.equal(evaluateVerify(rubric, { scores: [2,2,1,1], freshRecording: true }), true);
  const perItem = fourModulePreviews[1].verifyPolicy;
  const ids = perItem.itemIds;
  assert.equal(evaluateVerify(perItem, { reviewedItems: ids, passedItems: ids.slice(0,5), repeatedItems: [] }), true);
  assert.equal(evaluateVerify(perItem, { reviewedItems: ids.slice(0,5), passedItems: ids.slice(0,5), repeatedItems: [] }), false);
  assert.equal(evaluateVerify(perItem, { reviewedItems: ids, passedItems: ids.slice(0,5), repeatedItems: [ids[0]] }), false);
});

test('response builder scopes fields to one activity and emits typed multi-select', () => {
  const activity = {id:'choices',type:'choice',title:'Synthetic',instructions:'Synthetic',payload:{items:[{id:'q1',prompt:'Synthetic',fields:[{id:'multi',mode:'multi',options:[{id:'a',text:'A'},{id:'b',text:'B'}]}]}]}};
  assert.deepEqual(activityResponse(activity,{'q1-multi':'a,b',foreign:'must not leak'}),{'q1-multi':['a','b']});
});
