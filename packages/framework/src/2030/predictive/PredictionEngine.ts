import { CommandEnvelope } from '@/src/lib/actor/types';
import { PredictedCommand } from './types';

export class PredictionEngine {
  private history: CommandEnvelope[] = [];
  private readonly maxHistory = 50;

  /**
   * Adds a command to the history and returns the next 3 likely commands.
   */
  public analyze(envelope: CommandEnvelope): PredictedCommand[] {
    this.history.push(envelope);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return this.predictNext();
  }

  /**
   * Predicts the next 3 likely commands based on the current history.
   * In a real 2030 system, this would use a transformer-based model.
   * Here we use a frequency-based transition analysis.
   */
  private predictNext(): PredictedCommand[] {
    if (this.history.length === 0) return [];

    const lastCommand = this.history[this.history.length - 1];
    const transitions = new Map<string, { count: number; next: CommandEnvelope }>();

    // Analyze transitions from the last command type to others in history
    for (let i = 0; i < this.history.length - 1; i++) {
      if (this.history[i].command === lastCommand.command) {
        const next = this.history[i + 1];
        const key = `${next.actor.kind}:${next.command}`;
        const entry = transitions.get(key) || { count: 0, next };
        entry.count++;
        transitions.set(key, entry);
      }
    }

    // Sort by frequency and take top 3
    const sorted = Array.from(transitions.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return sorted.map((entry, index) => ({
      envelope: {
        ...entry.next,
        id: `pred_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        idempotencyKey: `pred_key_${Math.random().toString(36).substr(2, 9)}`,
      },
      probability: Math.min(0.9, entry.count / this.history.length + 0.1 / (index + 1)),
      reason: `Historical transition frequency from ${lastCommand.command}`,
    }));
  }
}
