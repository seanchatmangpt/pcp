import { MembraneChain } from './MembraneChain';
import { MembraneReceipt, TemporalRoute } from './types';

export class TemporalNavigator {
  private chain: MembraneChain;
  private currentTimestamp: number;
  private subscribers: Set<(route: TemporalRoute) => void> = new Set();

  constructor(chain: MembraneChain) {
    this.chain = chain;
    this.currentTimestamp = Date.now();
  }

  navigate(path: string, state: Record<string, any>) {
    const timestamp = Date.now();
    const receipt: MembraneReceipt = {
      id: Math.random().toString(36).substring(7),
      timestamp,
      path,
      state,
    };
    this.chain.append(receipt);
    this.currentTimestamp = timestamp;
    this.notify();
  }

  travelTo(timestamp: number) {
    const receipt = this.chain.getReceiptAt(timestamp);
    if (receipt) {
      this.currentTimestamp = timestamp;
      this.notify();
    } else {
      throw new Error(`No state found at timestamp ${timestamp}`);
    }
  }

  getCurrentRoute(): TemporalRoute | null {
    const receipt = this.chain.getReceiptAt(this.currentTimestamp);
    if (!receipt) return null;
    return {
      path: receipt.path,
      state: receipt.state,
      timestamp: receipt.timestamp,
    };
  }

  subscribe(callback: (route: TemporalRoute) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    const route = this.getCurrentRoute();
    if (route) {
      this.subscribers.forEach((cb) => cb(route));
    }
  }
}
