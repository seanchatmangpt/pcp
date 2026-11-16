/**
 * OCEL 2.0 Compliant Event Log Emitter and Parser.
 * Governs serialization and deserialization of Object-Centric Event Logs.
 * See [process-mining.md](file:///Users/sac/pcpapp/docs/vision2030/framework/process-mining.md) for details.
 */

export interface Ocel2Attribute {
  name: string;
  type: string; // e.g., 'string', 'timestamp', 'boolean', 'float'
}

export interface Ocel2AttributeValue {
  name: string;
  value: any;
  time?: string; // Optional lifecycle time indicator in OCEL 2.0
}

export interface Ocel2Relationship {
  objectId: string;
  qualifier: string; // The role/qualifier of the object in this event
}

export interface Ocel2Event {
  type: string;
  time: string; // ISO-8601 string
  relationships: Ocel2Relationship[];
  attributes?: Ocel2AttributeValue[];
}

export interface Ocel2Object {
  type: string;
  attributes?: Ocel2AttributeValue[];
}

export interface Ocel2LogData {
  eventTypes: Record<string, { attributes: Ocel2Attribute[] }>;
  objectTypes: Record<string, { attributes: Ocel2Attribute[] }>;
  events: Record<string, Ocel2Event>;
  objects: Record<string, Ocel2Object>;
}

export class Ocel2Log {
  private data: Ocel2LogData;

  constructor() {
    this.data = {
      eventTypes: {},
      objectTypes: {},
      events: {},
      objects: {},
    };
  }

  /**
   * Register an event type along with its attributes.
   */
  public registerEventType(name: string, attributes: Ocel2Attribute[]): this {
    this.data.eventTypes[name] = { attributes };
    return this;
  }

  /**
   * Register an object type along with its attributes.
   */
  public registerObjectType(name: string, attributes: Ocel2Attribute[]): this {
    this.data.objectTypes[name] = { attributes };
    return this;
  }

  /**
   * Add a new event to the OCEL log.
   */
  public addEvent(
    id: string,
    type: string,
    time: string | Date,
    relationships: Ocel2Relationship[],
    attributes?: Ocel2AttributeValue[]
  ): this {
    const timeStr = time instanceof Date ? time.toISOString() : time;
    this.data.events[id] = {
      type,
      time: timeStr,
      relationships,
      attributes,
    };
    return this;
  }

  /**
   * Add a new object to the OCEL log.
   */
  public addObject(id: string, type: string, attributes?: Ocel2AttributeValue[]): this {
    this.data.objects[id] = {
      type,
      attributes,
    };
    return this;
  }

  /**
   * Get the internal data of the OCEL log.
   */
  public getData(): Ocel2LogData {
    return this.data;
  }

  /**
   * Serialize log to JSON string.
   */
  public serialize(pretty = false): string {
    return JSON.stringify(this.data, null, pretty ? 2 : undefined);
  }

  /**
   * Parse a JSON string into an Ocel2Log instance.
   */
  public static parse(jsonStr: string): Ocel2Log {
    const parsed = JSON.parse(jsonStr);
    const log = new Ocel2Log();

    if (parsed && typeof parsed === 'object') {
      log.data.eventTypes = parsed.eventTypes || {};
      log.data.objectTypes = parsed.objectTypes || {};
      log.data.events = parsed.events || {};
      log.data.objects = parsed.objects || {};
    }

    return log;
  }
}

// Helper functions for conformance tests
export function createOCEL2Event(
  id: string,
  activity: string,
  timestamp: string,
  omap: string[],
  vmap: Record<string, any>
): any {
  return {
    'ocel:id': id,
    'ocel:activity': activity,
    'ocel:timestamp': timestamp,
    'ocel:omap': omap,
    'ocel:vmap': {
      ...vmap,
      verification_engine_link:
        '[PostQuantumZkEngine.ts](file:///Users/sac/pcpapp/src/framework/2030/identity/PostQuantumZkEngine.ts)',
      membrane_engine_link:
        '[membrane.ts](file:///Users/sac/pcpapp/src/framework/membrane/membrane.ts)',
    },
  };
}

export function createOCEL2Object(id: string, type: string, attributes: Record<string, any>): any {
  return {
    'ocel:id': id,
    'ocel:type': type,
    'ocel:vmap': attributes,
  };
}

export function emitOCEL2Log(events: any[], objects: any[]): any {
  return {
    'ocel:global-log': {
      'ocel:version': '2.0',
      'ocel:ordering': 'timestamp',
    },
    'ocel:events': events,
    'ocel:objects': objects,
  };
}

export function parseOCEL2Log(jsonStr: string): any {
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OCEL 2.0 log must be an object');
  }
  if (!Array.isArray(parsed['ocel:events'])) {
    throw new Error("OCEL 2.0 log must contain an 'ocel:events' array");
  }
  if (!Array.isArray(parsed['ocel:objects'])) {
    throw new Error("OCEL 2.0 log must contain an 'ocel:objects' array");
  }
  for (const event of parsed['ocel:events']) {
    if (
      !event ||
      typeof event !== 'object' ||
      !event['ocel:id'] ||
      !event['ocel:activity'] ||
      !event['ocel:timestamp'] ||
      !Array.isArray(event['ocel:omap'])
    ) {
      throw new Error('Event is malformed');
    }
  }
  return parsed;
}
