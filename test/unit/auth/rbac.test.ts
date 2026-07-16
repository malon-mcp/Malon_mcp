import { test } from 'node:test';
import assert from 'node:assert/strict';

test('rbac module', async (t) => {
  await t.test('admin has all permissions', async () => {
    const { hasPermission } = await import('../../../src/auth/rbac.js');
    assert.ok(hasPermission('admin', 'admin'));
    assert.ok(hasPermission('admin', 'search'));
    assert.ok(hasPermission('admin', 'purge_data'));
    assert.ok(hasPermission('admin', 'manage_users'));
    assert.ok(hasPermission('admin', 'manage_sessions'));
  });

  await t.test('viewer has only status', async () => {
    const { hasPermission } = await import('../../../src/auth/rbac.js');
    assert.ok(hasPermission('viewer', 'status'));
    assert.equal(hasPermission('viewer', 'search'), false);
    assert.equal(hasPermission('viewer', 'memory_write'), false);
    assert.equal(hasPermission('viewer', 'manage_api_keys'), false);
  });

  await t.test('user has search, memory, checkpoint, status', async () => {
    const { hasPermission } = await import('../../../src/auth/rbac.js');
    assert.ok(hasPermission('user', 'search'));
    assert.ok(hasPermission('user', 'memory_read'));
    assert.ok(hasPermission('user', 'memory_write'));
    assert.ok(hasPermission('user', 'checkpoint'));
    assert.ok(hasPermission('user', 'status'));
    assert.equal(hasPermission('user', 'manage_api_keys'), false);
    assert.equal(hasPermission('user', 'purge_data'), false);
  });

  await t.test('operator has elevated permissions', async () => {
    const { hasPermission } = await import('../../../src/auth/rbac.js');
    assert.ok(hasPermission('operator', 'manage_api_keys'));
    assert.ok(hasPermission('operator', 'view_usage'));
    assert.ok(hasPermission('operator', 'manage_mfa'));
    assert.equal(hasPermission('operator', 'manage_users'), false);
    assert.equal(hasPermission('operator', 'purge_data'), false);
    assert.equal(hasPermission('operator', 'admin'), false);
  });

  await t.test('service has limited permissions', async () => {
    const { hasPermission } = await import('../../../src/auth/rbac.js');
    assert.ok(hasPermission('service', 'search'));
    assert.ok(hasPermission('service', 'memory_read'));
    assert.ok(hasPermission('service', 'memory_write'));
    assert.ok(hasPermission('service', 'status'));
    assert.equal(hasPermission('service', 'checkpoint'), false);
    assert.equal(hasPermission('service', 'manage_api_keys'), false);
  });

  await t.test('roleLevel returns correct hierarchy', async () => {
    const { roleLevel } = await import('../../../src/auth/rbac.js');
    assert.ok(roleLevel('admin') > roleLevel('operator'));
    assert.ok(roleLevel('operator') > roleLevel('service'));
    assert.ok(roleLevel('service') > roleLevel('user'));
    assert.ok(roleLevel('user') > roleLevel('viewer'));
  });

  await t.test('isRoleAtLeast checks hierarchy', async () => {
    const { isRoleAtLeast } = await import('../../../src/auth/rbac.js');
    assert.ok(isRoleAtLeast('admin', 'user'));
    assert.ok(isRoleAtLeast('operator', 'viewer'));
    assert.ok(isRoleAtLeast('user', 'user'));
    assert.equal(isRoleAtLeast('viewer', 'admin'), false);
  });

  await t.test('requirePermission throws on insufficient role', async () => {
    const { requirePermission } = await import('../../../src/auth/rbac.js');
    assert.throws(() => requirePermission('viewer', 'search'), /does not have permission/);
    assert.throws(() => requirePermission('user', 'manage_api_keys'), /does not have permission/);
  });

  await t.test('requirePermission does not throw on sufficient role', async () => {
    const { requirePermission } = await import('../../../src/auth/rbac.js');
    requirePermission('admin', 'search');
    requirePermission('user', 'checkpoint');
    requirePermission('viewer', 'status');
  });

  await t.test('listRoles returns all roles', async () => {
    const { listRoles } = await import('../../../src/auth/rbac.js');
    const roles = listRoles();
    assert.ok(roles.includes('admin'));
    assert.ok(roles.includes('operator'));
    assert.ok(roles.includes('service'));
    assert.ok(roles.includes('user'));
    assert.ok(roles.includes('viewer'));
  });
});
