import { useState, useEffect } from 'react';

export type Algorithm = 'SHA-256' | 'Dilithium' | 'Falcon';

export interface ActiveReceiptChain {
  algorithm: Algorithm;
  receipts: string[];
}

export class TemporalRedTeamDaemon {
  private chain: ActiveReceiptChain;
  private threatSimulationTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: ((chain: ActiveReceiptChain) => void)[] = [];

  constructor() {
    this.chain = {
      algorithm: 'SHA-256',
      receipts: [],
    };
  }

  startSimulation(delayMs: number = 1000) {
    if (this.threatSimulationTimer) {
      return;
    }

    this.threatSimulationTimer = setTimeout(() => {
      this.simulateQuantumBreak();
    }, delayMs);
  }

  stopSimulation() {
    if (this.threatSimulationTimer) {
      clearTimeout(this.threatSimulationTimer);
      this.threatSimulationTimer = null;
    }
  }

  private simulateQuantumBreak() {
    this.forceQuantumBreak('Dilithium');
  }

  public forceQuantumBreak(newAlgorithm: Algorithm = 'Dilithium') {
    this.chain.algorithm = newAlgorithm;
    this.chain.receipts = this.chain.receipts.map(
      (r) => `${r}-upgraded-to-${this.chain.algorithm}`
    );
    this.notifyListeners();
  }

  public addReceipt(data: string) {
    this.chain.receipts.push(`${data}-hashed-with-${this.chain.algorithm}`);
    this.notifyListeners();
  }

  public getChain(): ActiveReceiptChain {
    return this.chain;
  }

  public subscribe(listener: (chain: ActiveReceiptChain) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener({ ...this.chain, receipts: [...this.chain.receipts] });
    }
  }
}

export const daemonInstance = new TemporalRedTeamDaemon();

export function useCryptoAgility() {
  const [chain, setChain] = useState<ActiveReceiptChain>(daemonInstance.getChain());

  useEffect(() => {
    const unsubscribe = daemonInstance.subscribe((newChain) => {
      setChain(newChain);
    });
    return unsubscribe;
  }, []);

  return chain;
}
