/**
 * @fileoverview Actor Registry managing mapping from actor kind to behavior specification.
 */

import { ActorBehavior } from './types';

export class ActorRegistry {
  private static instance: ActorRegistry | null = null;
  private behaviors: Map<string, ActorBehavior> = new Map();

  private constructor() {}

  public static getInstance(): ActorRegistry {
    if (!ActorRegistry.instance) {
      ActorRegistry.instance = new ActorRegistry();
    }
    return ActorRegistry.instance;
  }

  /**
   * Register behavior for a specific actor kind.
   */
  public register(behavior: ActorBehavior): void {
    if (this.behaviors.has(behavior.actorKind)) {
      throw new Error(`Behavior for actor kind '${behavior.actorKind}' is already registered.`);
    }
    this.behaviors.set(behavior.actorKind, behavior);
  }

  /**
   * Resolves the behavior for an actor kind.
   */
  public resolve(kind: string): ActorBehavior {
    const behavior = this.behaviors.get(kind);
    if (!behavior) {
      throw new Error(`No behavior registered for actor kind '${kind}'.`);
    }
    return behavior;
  }

  /**
   * Resets all registrations. Mainly used in test suites.
   */
  public clear(): void {
    this.behaviors.clear();
  }
}
