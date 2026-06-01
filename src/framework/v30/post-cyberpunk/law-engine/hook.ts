import { useState, useCallback, useRef } from 'react';
import { LawEngineConfig, FutureClaim, BoardProjection, Receipt, Replay } from './interfaces';
import { BlueRiverDam } from './engine';

export function useLawEngine(config: LawEngineConfig) {
  const engineRef = useRef<BlueRiverDam | null>(null);

  if (engineRef.current == null) {
    engineRef.current = new BlueRiverDam(config);
  }

  const [projection, setProjection] = useState<BoardProjection>(() =>
    engineRef.current!.getProjection()
  );

  const submitClaim = useCallback(async (claim: FutureClaim): Promise<Receipt> => {
    const receipt = await engineRef.current!.submitClaim(claim);
    setProjection(engineRef.current!.getProjection());
    return receipt;
  }, []);

  const replayReceipt = useCallback(async (receiptId: string): Promise<Replay> => {
    const replay = await engineRef.current!.replayReceipt(receiptId);
    setProjection(engineRef.current!.getProjection());
    return replay;
  }, []);

  return {
    submitClaim,
    replayReceipt,
    projection,
  };
}
