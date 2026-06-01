import { IdentityManager } from '../IdentityManager';
import { Tenant, Group, Role, User, IdentityState } from '../types';

describe('IdentityManager', () => {
  const mockTenants: Tenant[] = [
    { id: 't1', name: 'Tenant 1' },
    { id: 't2', name: 'Tenant 2' },
  ];

  const mockGroups: Group[] = [
    { id: 'g1', tenantId: 't1', name: 'Group 1' },
    { id: 'g2', tenantId: 't1', parentId: 'g1', name: 'Group 2' },
    { id: 'g3', tenantId: 't2', name: 'Group 3' },
  ];

  const mockRoles: Role[] = [
    { id: 'r1', tenantId: 't1', name: 'Admin', permissions: ['read', 'write'] },
    { id: 'r2', tenantId: 't1', name: 'User', permissions: ['read'] },
    { id: 'r3', tenantId: 't2', name: 'Manager', permissions: ['manage'] },
  ];

  const mockUser: User = {
    id: 'u1',
    email: 'user@example.com',
    memberships: [
      { tenantId: 't1', roleIds: ['r2'] }, // Tenant level
      { tenantId: 't1', groupId: 'g1', roleIds: ['r1'] }, // Group 1 level
      { tenantId: 't2', groupId: 'g3', roleIds: ['r3'] }, // Group 3 level
    ],
  };

  const initialState: IdentityState = {
    user: mockUser,
  };

  let manager: IdentityManager;

  beforeEach(() => {
    manager = new IdentityManager(initialState, mockTenants, mockGroups, mockRoles);
  });

  test('should auto-select the first tenant from memberships if none provided', () => {
    expect(manager.getState().activeTenantId).toBe('t1');
  });

  test('should not auto-select tenant if one is already active', () => {
    const state: IdentityState = { user: mockUser, activeTenantId: 't2' };
    const manager2 = new IdentityManager(state, mockTenants, mockGroups, mockRoles);
    expect(manager2.getState().activeTenantId).toBe('t2');
  });

  test('should not auto-select tenant if user has no memberships', () => {
    const userNoMemberships: User = { ...mockUser, memberships: [] };
    const manager2 = new IdentityManager(
      { user: userNoMemberships },
      mockTenants,
      mockGroups,
      mockRoles
    );
    expect(manager2.getState().activeTenantId).toBeUndefined();
  });

  test('should switch tenant successfully', () => {
    manager.switchTenant('t2');
    expect(manager.getState().activeTenantId).toBe('t2');
  });

  test('should throw error when switching to a tenant the user is not a member of', () => {
    expect(() => manager.switchTenant('t3')).toThrow('User is not a member of tenant: t3');
  });

  test('should switch group successfully', () => {
    manager.switchGroup('g1');
    expect(manager.getState().activeGroupId).toBe('g1');
  });

  test('should throw error when switching to a non-existent group', () => {
    expect(() => manager.switchGroup('non-existent')).toThrow('Group not found: non-existent');
  });

  test('should throw error when switching to a group in a different tenant', () => {
    expect(() => manager.switchGroup('g3')).toThrow(
      'Group g3 does not belong to the active tenant t1'
    );
  });

  test('should throw error when switching to a group the user has no access to', () => {
    manager.switchTenant('t2');
    // User only has access to g3 in t2. Let's add a group g4 in t2 that user has no access to.
    const managerWithG4 = new IdentityManager(
      initialState,
      mockTenants,
      [...mockGroups, { id: 'g4', tenantId: 't2', name: 'Group 4' }],
      mockRoles
    );
    managerWithG4.switchTenant('t2');
    expect(() => managerWithG4.switchGroup('g4')).toThrow('User does not have access to group: g4');
  });

  test('should reset group when switching to a tenant that the group does not belong to', () => {
    manager.switchGroup('g1');
    manager.switchTenant('t2');
    expect(manager.getState().activeGroupId).toBeUndefined();
  });

  test('should reset group when switching tenant and group is not found', () => {
    manager.switchGroup('g1');
    // Manually remove g1 from groups to simulate inconsistency
    (manager as any).groups.delete('g1');
    manager.switchTenant('t1'); // Should still work and reset group
    expect(manager.getState().activeGroupId).toBeUndefined();
  });

  test('should handle missing roles gracefully in getContext', () => {
    // User has role r2. Let's remove it from mockRoles.
    const managerNoRoles = new IdentityManager(initialState, mockTenants, mockGroups, []);
    const context = managerNoRoles.getContext();
    expect(context.roles).toHaveLength(0);
    expect(context.permissions).toHaveLength(0);
  });

  test('should resolve context correctly for tenant-level memberships', () => {
    const context = manager.getContext();
    expect(context.tenant?.id).toBe('t1');
    expect(context.group).toBeUndefined();
    expect(context.roles.map((r) => r.id)).toContain('r2');
    expect(context.permissions).toEqual(['read']);
  });

  test('should resolve context correctly for group-level memberships with inheritance', () => {
    manager.switchGroup('g1');
    const context = manager.getContext();
    expect(context.group?.id).toBe('g1');
    // Roles from t1 (r2) and g1 (r1)
    expect(context.roles.map((r) => r.id)).toContain('r1');
    expect(context.roles.map((r) => r.id)).toContain('r2');
    expect(context.permissions).toContain('read');
    expect(context.permissions).toContain('write');
  });

  test('should resolve context correctly for nested group memberships (inheritance from parent)', () => {
    manager.switchGroup('g2'); // User has membership in g1, which is parent of g2
    const context = manager.getContext();
    expect(context.group?.id).toBe('g2');
    expect(context.roles.map((r) => r.id)).toContain('r1'); // from g1
    expect(context.roles.map((r) => r.id)).toContain('r2'); // from t1
    expect(context.permissions).toContain('read');
    expect(context.permissions).toContain('write');
  });

  test('should allow switching to a child group if user has parent group membership', () => {
    expect(() => manager.switchGroup('g2')).not.toThrow();
    expect(manager.getState().activeGroupId).toBe('g2');
  });

  test('should admit user to a new group', () => {
    // Create a user with NO tenant-level membership, only specific group membership
    const restrictedUser: User = {
      id: 'u2',
      email: 'restricted@example.com',
      memberships: [{ tenantId: 't1', groupId: 'g1', roleIds: ['r2'] }],
    };

    const groupsWithG4 = [...mockGroups, { id: 'g4', tenantId: 't1', name: 'Group 4' }];
    manager = new IdentityManager({ user: restrictedUser }, mockTenants, groupsWithG4, mockRoles);

    // Should throw because user only has access to g1 and its children (g2), not g4
    expect(() => manager.switchGroup('g4')).toThrow();

    manager.admitToGroup('g4', ['r1']);
    expect(() => manager.switchGroup('g4')).not.toThrow();
    expect(manager.getContext().roles.map((r) => r.id)).toContain('r1');
  });

  test('should throw error when admitting to non-existent group', () => {
    expect(() => manager.admitToGroup('non-existent', ['r1'])).toThrow(
      'Group not found: non-existent'
    );
  });

  test('should handle deep hierarchies in isDescendant', () => {
    const deepGroups: Group[] = [
      { id: 'level1', tenantId: 't1', name: 'L1' },
      { id: 'level2', tenantId: 't1', parentId: 'level1', name: 'L2' },
      { id: 'level3', tenantId: 't1', parentId: 'level2', name: 'L3' },
      { id: 'level4', tenantId: 't1', parentId: 'level3', name: 'L4' },
    ];
    const userWithL1: User = {
      ...mockUser,
      memberships: [{ tenantId: 't1', groupId: 'level1', roleIds: ['r1'] }],
    };
    const deepManager = new IdentityManager(
      { user: userWithL1 },
      mockTenants,
      deepGroups,
      mockRoles
    );

    deepManager.switchGroup('level4');
    const context = deepManager.getContext();
    expect(context.roles.map((r) => r.id)).toContain('r1');
  });
});
