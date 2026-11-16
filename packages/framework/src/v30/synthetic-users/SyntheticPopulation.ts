export interface UserProfile {
  id: string;
  name: string;
  behavioralPattern: 'aggressive' | 'passive' | 'sporadic' | 'consistent';
  activityLevel: number; // 0 to 1
}

export interface Interaction {
  userId: string;
  timestamp: number;
  action: string;
  payload: Record<string, any>;
  durationMs: number;
}

export class LocalLLMStub {
  generateProfile(seed: number): UserProfile {
    const patterns: ('aggressive' | 'passive' | 'sporadic' | 'consistent')[] = [
      'aggressive',
      'passive',
      'sporadic',
      'consistent',
    ];
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi'];
    return {
      id: `usr_${seed}_${Date.now()}`,
      name: names[seed % names.length],
      behavioralPattern: patterns[seed % patterns.length],
      activityLevel: (seed % 100) / 100,
    };
  }

  generateInteractionStream(profile: UserProfile, count: number): Interaction[] {
    const actions = ['login', 'click', 'scroll', 'type', 'logout', 'purchase'];
    const interactions: Interaction[] = [];
    let currentTime = Date.now();
    for (let i = 0; i < count; i++) {
      let durationMs = 100 + Math.random() * 900;
      if (profile.behavioralPattern === 'aggressive') {
        durationMs = 50 + Math.random() * 200;
      } else if (profile.behavioralPattern === 'passive') {
        durationMs = 1000 + Math.random() * 5000;
      }

      let actionIndex = Math.floor(i + profile.activityLevel * 100) % actions.length;
      if (isNaN(actionIndex) || actionIndex < 0) {
        actionIndex = 1; // Default to 'click'
      }

      interactions.push({
        userId: profile.id,
        timestamp: currentTime,
        action: actions[actionIndex],
        payload: { x: Math.random() * 1000, y: Math.random() * 1000 },
        durationMs,
      });
      currentTime += durationMs + (1000 - profile.activityLevel * 900); // Higher activity = less wait time
    }
    return interactions;
  }
}

export class SyntheticPopulationEngine {
  private llmStub: LocalLLMStub;
  private activeProfiles: Map<string, UserProfile> = new Map();
  private interactionCache: Interaction[] = [];
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private onInteractionGenerated?: (interaction: Interaction) => void;

  constructor() {
    this.llmStub = new LocalLLMStub();
  }

  setInteractionCallback(callback: (interaction: Interaction) => void) {
    this.onInteractionGenerated = callback;
  }

  spawnProfiles(count: number): UserProfile[] {
    const newProfiles: UserProfile[] = [];
    for (let i = 0; i < count; i++) {
      const profile = this.llmStub.generateProfile(i + this.activeProfiles.size);
      this.activeProfiles.set(profile.id, profile);
      newProfiles.push(profile);
    }
    return newProfiles;
  }

  getProfiles(): UserProfile[] {
    return Array.from(this.activeProfiles.values());
  }

  getCacheSize(): number {
    return this.interactionCache.length;
  }

  clearCache(): void {
    this.interactionCache = [];
  }

  startBackgroundSimulation(batchSize: number = 10, intervalMs: number = 1000): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.simulateTick(batchSize);
    }, intervalMs);
  }

  simulateTick(batchSize: number = 10): void {
    const profiles = Array.from(this.activeProfiles.values());
    if (profiles.length === 0) {
      return;
    }

    for (let i = 0; i < batchSize; i++) {
      const randomProfile = profiles[Math.floor(Math.random() * profiles.length)];
      // Generate a small burst of interactions for this tick
      const stream = this.llmStub.generateInteractionStream(
        randomProfile,
        Math.floor(Math.random() * 5) + 1
      );
      this.interactionCache.push(...stream);

      if (this.onInteractionGenerated) {
        for (const int of stream) {
          this.onInteractionGenerated(int);
        }
      }
    }
  }

  stopBackgroundSimulation(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
}
