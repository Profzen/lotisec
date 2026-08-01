const test=require('node:test');
const assert=require('node:assert/strict');
const {canTransition,INCIDENT_TRANSITIONS,INTERVENTION_TRANSITIONS,RIDE_TRANSITIONS}=require('../dist/security/workflows');

test('le cycle incident interdit de terminer un incident non validé',()=>{
  assert.equal(canTransition(INCIDENT_TRANSITIONS,'new','completed'),false);
  assert.equal(canTransition(INCIDENT_TRANSITIONS,'new','validated'),true);
});

test('une intervention suit les étapes terrain',()=>{
  assert.equal(canTransition(INTERVENTION_TRANSITIONS,'assigned','accepted'),true);
  assert.equal(canTransition(INTERVENTION_TRANSITIONS,'accepted','completed'),false);
  assert.equal(canTransition(INTERVENTION_TRANSITIONS,'arrived_hospital','completed'),true);
});

test('une course terminée ne peut plus changer',()=>{
  assert.equal(canTransition(RIDE_TRANSITIONS,'completed','canceled'),false);
  assert.equal(canTransition(RIDE_TRANSITIONS,'requested','accepted'),true);
});
