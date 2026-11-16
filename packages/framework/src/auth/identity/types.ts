/**
 * @fileoverview Type definitions for Multi-Tenant Organizational Identity.
 */

export type TenantId = string;
export type GroupId = string;
export type RoleId = string;
export type UserId = string;

/**
 * A Tenant represents a top-level organizational unit (e.g., a Company).
 */
export interface Tenant {
  id: TenantId;
  name: string;
  metadata?: Record<string, any>;
}

/**
 * A Group represents a sub-unit within a Tenant (e.g., a Department or Project).
 * Groups can be nested to form complex hierarchies.
 */
export interface Group {
  id: GroupId;
  tenantId: TenantId;
  parentId?: GroupId;
  name: string;
  metadata?: Record<string, any>;
}

/**
 * A Role defines a set of permissions within a Tenant.
 */
export interface Role {
  id: RoleId;
  tenantId: TenantId;
  name: string;
  permissions: readonly string[];
}

/**
 * A Membership links a User to a Tenant and optionally a Group, with specific Roles.
 */
export interface Membership {
  tenantId: TenantId;
  groupId?: GroupId;
  roleIds: readonly RoleId[];
}

/**
 * A User in the system.
 */
export interface User {
  id: UserId;
  email: string;
  memberships: readonly Membership[];
  metadata?: Record<string, any>;
}

/**
 * The current identity state for a session.
 */
export interface IdentityState {
  user: User;
  activeTenantId?: TenantId;
  activeGroupId?: GroupId;
}

/**
 * Resolved identity details for the active context.
 */
export interface IdentityContext {
  user: User;
  tenant?: Tenant;
  group?: Group;
  roles: readonly Role[];
  permissions: readonly string[];
}
