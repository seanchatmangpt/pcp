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
});
