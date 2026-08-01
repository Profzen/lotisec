const test = require('node:test');
const assert = require('node:assert/strict');
const { permissionsFor, hasPermission, rolesForOrganization, ROLE_KEYS } = require('../dist/security/rbac');

test('admin possède toutes les permissions', () => {
  const permissions = permissionsFor(['admin']);
  assert.equal(hasPermission(permissions, 'incidents:manage'), true);
  assert.equal(hasPermission(permissions, 'admin:manage'), true);
});

test('un agent hospitalier ne supervise pas les incidents', () => {
  const permissions = permissionsFor(['hospital_agent']);
  assert.equal(hasPermission(permissions, 'admissions:organization'), true);
  assert.equal(hasPermission(permissions, 'incidents:manage'), false);
});

test('les rôles cumulés fusionnent leurs permissions', () => {
  const permissions = permissionsFor(['citizen','zem_driver']);
  assert.equal(hasPermission(permissions, 'incidents:create'), true);
  assert.equal(hasPermission(permissions, 'zem:drive'), true);
});

test('les neuf rôles attendus sont déclarés', () => {
  assert.deepEqual(ROLE_KEYS, ['admin','supervisor','dispatcher','firefighter','ambulance_driver','hospital_manager','hospital_agent','zem_driver','citizen']);
});

test('les rôles institutionnels sont isolés par organisation', () => {
  const rows=[{role_key:'citizen',organization_id:null},{role_key:'hospital_manager',organization_id:'hospital-a'},{role_key:'dispatcher',organization_id:'dispatch-b'}];
  assert.deepEqual(rolesForOrganization(rows,'hospital-a'),['citizen','hospital_manager']);
  assert.deepEqual(rolesForOrganization(rows,'dispatch-b'),['citizen','dispatcher']);
  assert.deepEqual(rolesForOrganization(rows,'unknown'),['citizen']);
});

test('les comptes terrain et hospitaliers restent dans leur périmètre', () => {
  const firefighter=permissionsFor(['firefighter']);
  const manager=permissionsFor(['hospital_manager']);
  const citizen=permissionsFor(['citizen']);
  assert.equal(hasPermission(firefighter,'interventions:update'),true);
  assert.equal(hasPermission(firefighter,'incidents:manage'),false);
  assert.equal(hasPermission(manager,'organization:members'),true);
  assert.equal(hasPermission(manager,'admin:manage'),false);
  assert.equal(hasPermission(citizen,'admin:manage'),false);
});
