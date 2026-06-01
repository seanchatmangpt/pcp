import {
  Tenant,
  Group,
  Role,
  User,
  Membership,
  IdentityState,
  IdentityContext,
  TenantId,
  GroupId,
  RoleId,
  UserId,
} from './types';

/**
 * IdentityManager provides a fluent API for managing multi-tenant identity contexts,
 * tenant switching, and permission resolution within hierarchical organizations.
 */
export class IdentityManager {
  private state: IdentityState;
  private tenants: Map<TenantId, Tenant>;
  private groups: Map<GroupId, Group>;
  private roles: Map<RoleId, Role>;

  constructor(
    initialState: IdentityState,
    tenants: Tenant[] = [],
    groups: Group[] = [],
    roles: Role[] = []
  ) {
    this.state = { ...initialState };
    this.tenants = new Map(tenants.map((t) => [t.id, t]));
    this.groups = new Map(groups.map((g) => [g.id, g]));
    this.roles = new Map(roles.map((r) => [r.id, r]));

    // Auto-select first tenant if none active
    if (!this.state.activeTenantId && this.state.user.memberships.length > 0) {
      this.state.activeTenantId = this.state.user.memberships[0].tenantId;
    }
  }

  /**
   * Switches the active tenant context.
   * Clears the active group if it doesn't belong to the new tenant.
   */
  public switchTenant(tenantId: TenantId): this {
    const hasMembership = this.state.user.memberships.some((m) => m.tenantId === tenantId);
    if (!hasMembership) {
      throw new Error(`User is not a member of tenant: ${tenantId}`);
    }

    this.state.activeTenantId = tenantId;

    // Reset group if it's not in the new tenant
    if (this.state.activeGroupId) {
      const group = this.groups.get(this.state.activeGroupId);
      if (!group || group.tenantId !== tenantId) {
        this.state.activeGroupId = undefined;
      }
    }

    return this;
  }

  /**
   * Switches the active group context within the current tenant.
   */
  public switchGroup(groupId: GroupId): this {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    if (group.tenantId !== this.state.activeTenantId) {
      throw new Error(
        `Group ${groupId} does not belong to the active tenant ${this.state.activeTenantId}`
      );
    }

    const hasAccess = this.state.user.memberships.some(
      (m) =>
        m.tenantId === group.tenantId &&
        (!m.groupId || m.groupId === groupId || this.isDescendant(groupId, m.groupId))
    );

    if (!hasAccess) {
      throw new Error(`User does not have access to group: ${groupId}`);
    }

    this.state.activeGroupId = groupId;
    return this;
  }

  /**
   * Resolves the current identity context, including effective roles and permissions.
   */
  public getContext(): IdentityContext {
    const { user, activeTenantId, activeGroupId } = this.state;
    const tenant = activeTenantId ? this.tenants.get(activeTenantId) : undefined;
    const group = activeGroupId ? this.groups.get(activeGroupId) : undefined;

    const effectiveRoles: Role[] = [];
    const permissionSet = new Set<string>();

    // Collect memberships that apply to the current context
    const applicableMemberships = user.memberships.filter((m) => {
      if (m.tenantId !== activeTenantId) return false;

      // Tenant-level memberships always apply within the tenant
      if (!m.groupId) return true;

      // If a group is active, memberships at that group OR parent groups apply (inheritance)
      return (
        m.groupId === activeGroupId ||
        (activeGroupId && this.isDescendant(activeGroupId, m.groupId))
      );
    });

    for (const membership of applicableMemberships) {
      for (const roleId of membership.roleIds) {
        const role = this.roles.get(roleId);
        if (role) {
          effectiveRoles.push(role);
          role.permissions.forEach((p) => permissionSet.add(p));
        }
      }
    }

    return {
      user,
      tenant,
      group,
      roles: Object.freeze(effectiveRoles),
      permissions: Object.freeze(Array.from(permissionSet)),
    };
  }

  /**
   * Helper to check if a group is a descendant of another group.
   */
  private isDescendant(childId: GroupId, ancestorId?: GroupId): boolean {
    if (!ancestorId) return false;
    let current = this.groups.get(childId);
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true;
      current = this.groups.get(current.parentId);
    }
    return false;
  }

  /**
   * Simulates group admission by adding a membership to the user.
   * In a real system, this would call an API.
   */
  public admitToGroup(groupId: GroupId, roleIds: RoleId[]): this {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    const newMembership: Membership = {
      tenantId: group.tenantId,
      groupId,
      roleIds: [...roleIds],
    };

    // Use a new user object to maintain immutability-like behavior if needed,
    // though here we are managing internal state.
    this.state.user = {
      ...this.state.user,
      memberships: [...this.state.user.memberships, newMembership],
    };

    return this;
  }

  /**
   * Returns the current state.
   */
  public getState(): Readonly<IdentityState> {
    return Object.freeze({ ...this.state });
  }
}
