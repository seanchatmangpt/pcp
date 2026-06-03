export type PerspectiveType = 'control_flow' | 'data' | 'resource' | 'temporal' | 'social';

export interface Role {
    id: string;
    name: string;
    description: string | null;
}

export interface Resource {
    id: string;
    name: string;
    roles: string[];
    attributes: Record<string, unknown>;
}

export interface PerspectiveRefusal {
    id: string;
    reason: string;
    timestamp: number;
    perspectiveType: PerspectiveType;
    resourceId: string | null;
    details: Record<string, unknown> | null;
}

export interface MultiperspectiveEvent {
    id: string;
    caseId: string;
    activityName: string;
    timestamp: number;
    resourceId: string | null;
    roleId: string | null;
    data: Record<string, unknown>;
    perspectiveTypes: PerspectiveType[];
}
