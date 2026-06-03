import { 
    Role, 
    Resource, 
    PerspectiveRefusal, 
    MultiperspectiveEvent, 
    PerspectiveType 
} from './types';

export class MultiperspectiveLog {
    private readonly id: string;
    private readonly name: string;
    private readonly resources: Map<string, Resource>;
    private readonly roles: Map<string, Role>;
    private readonly refusals: Map<string, PerspectiveRefusal>;
    private readonly events: Map<string, MultiperspectiveEvent>;
    private readonly metadata: Record<string, unknown>;

    constructor(id: string, name: string, metadata: Record<string, unknown> = {}) {
        if (!id) throw new Error("MultiperspectiveLog requires a valid id.");
        if (!name) throw new Error("MultiperspectiveLog requires a valid name.");
        
        this.id = id;
        this.name = name;
        this.resources = new Map();
        this.roles = new Map();
        this.refusals = new Map();
        this.events = new Map();
        this.metadata = metadata;
    }

    public getId(): string {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public getMetadata(): Record<string, unknown> {
        return { ...this.metadata };
    }

    public addRole(role: Role): void {
        if (this.roles.has(role.id)) {
            throw new Error(`Role with id ${role.id} already exists in log.`);
        }
        if (!role.name) {
            throw new Error(`Role with id ${role.id} is missing a valid name.`);
        }
        this.roles.set(role.id, { ...role });
    }

    public getRole(id: string): Role | undefined {
        const role = this.roles.get(id);
        return role ? { ...role } : undefined;
    }

    public getAllRoles(): Role[] {
        return Array.from(this.roles.values()).map(r => ({ ...r }));
    }

    public addResource(resource: Resource): void {
        if (this.resources.has(resource.id)) {
            throw new Error(`Resource with id ${resource.id} already exists in log.`);
        }
        if (!resource.name) {
            throw new Error(`Resource with id ${resource.id} is missing a valid name.`);
        }
        for (const roleId of resource.roles) {
            if (!this.roles.has(roleId)) {
                throw new Error(`Role with id ${roleId} does not exist. Cannot add resource ${resource.id}.`);
            }
        }
        this.resources.set(resource.id, {
            ...resource,
            roles: [...resource.roles],
            attributes: { ...resource.attributes }
        });
    }

    public getResource(id: string): Resource | undefined {
        const resource = this.resources.get(id);
        if (!resource) return undefined;
        return {
            ...resource,
            roles: [...resource.roles],
            attributes: { ...resource.attributes }
        };
    }

    public getAllResources(): Resource[] {
        return Array.from(this.resources.values()).map(r => ({
            ...r,
            roles: [...r.roles],
            attributes: { ...r.attributes }
        }));
    }

    public addRefusal(refusal: PerspectiveRefusal): void {
        if (this.refusals.has(refusal.id)) {
            throw new Error(`Refusal with id ${refusal.id} already exists in log.`);
        }
        if (!refusal.reason) {
            throw new Error(`Refusal with id ${refusal.id} is missing a valid reason.`);
        }
        if (refusal.resourceId !== null && !this.resources.has(refusal.resourceId)) {
            throw new Error(`Resource with id ${refusal.resourceId} does not exist. Cannot add refusal ${refusal.id}.`);
        }
        this.refusals.set(refusal.id, {
            ...refusal,
            details: refusal.details ? { ...refusal.details } : null
        });
    }

    public getRefusal(id: string): PerspectiveRefusal | undefined {
        const refusal = this.refusals.get(id);
        if (!refusal) return undefined;
        return {
            ...refusal,
            details: refusal.details ? { ...refusal.details } : null
        };
    }

    public getAllRefusals(): PerspectiveRefusal[] {
        return Array.from(this.refusals.values()).map(r => ({
            ...r,
            details: r.details ? { ...r.details } : null
        }));
    }

    public getRefusalsByPerspectiveType(perspectiveType: PerspectiveType): PerspectiveRefusal[] {
        return Array.from(this.refusals.values())
            .filter(r => r.perspectiveType === perspectiveType)
            .map(r => ({
                ...r,
                details: r.details ? { ...r.details } : null
            }));
    }

    public addEvent(event: MultiperspectiveEvent): void {
        if (this.events.has(event.id)) {
            throw new Error(`Event with id ${event.id} already exists in log.`);
        }
        if (!event.activityName) {
            throw new Error(`Event with id ${event.id} is missing a valid activityName.`);
        }
        if (!event.caseId) {
            throw new Error(`Event with id ${event.id} is missing a valid caseId.`);
        }
        if (event.resourceId !== null && !this.resources.has(event.resourceId)) {
            throw new Error(`Resource with id ${event.resourceId} does not exist. Cannot add event ${event.id}.`);
        }
        if (event.roleId !== null && !this.roles.has(event.roleId)) {
            throw new Error(`Role with id ${event.roleId} does not exist. Cannot add event ${event.id}.`);
        }
        
        this.events.set(event.id, {
            ...event,
            data: { ...event.data },
            perspectiveTypes: [...event.perspectiveTypes]
        });
    }

    public getEvent(id: string): MultiperspectiveEvent | undefined {
        const event = this.events.get(id);
        if (!event) return undefined;
        return {
            ...event,
            data: { ...event.data },
            perspectiveTypes: [...event.perspectiveTypes]
        };
    }

    public getAllEvents(): MultiperspectiveEvent[] {
        return Array.from(this.events.values()).map(e => ({
            ...e,
            data: { ...e.data },
            perspectiveTypes: [...e.perspectiveTypes]
        }));
    }

    public getEventsByCaseId(caseId: string): MultiperspectiveEvent[] {
        return Array.from(this.events.values())
            .filter(e => e.caseId === caseId)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(e => ({
                ...e,
                data: { ...e.data },
                perspectiveTypes: [...e.perspectiveTypes]
            }));
    }

    public getEventsByResourceId(resourceId: string): MultiperspectiveEvent[] {
        if (!this.resources.has(resourceId)) {
            throw new Error(`Resource with id ${resourceId} does not exist in the log.`);
        }
        return Array.from(this.events.values())
            .filter(e => e.resourceId === resourceId)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(e => ({
                ...e,
                data: { ...e.data },
                perspectiveTypes: [...e.perspectiveTypes]
            }));
    }

    public validateLogIntegrity(): boolean {
        // Validation ensures no broken references
        for (const resource of this.resources.values()) {
            for (const roleId of resource.roles) {
                if (!this.roles.has(roleId)) return false;
            }
        }
        for (const refusal of this.refusals.values()) {
            if (refusal.resourceId !== null && !this.resources.has(refusal.resourceId)) return false;
        }
        for (const event of this.events.values()) {
            if (event.resourceId !== null && !this.resources.has(event.resourceId)) return false;
            if (event.roleId !== null && !this.roles.has(event.roleId)) return false;
        }
        return true;
    }
}
