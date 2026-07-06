import { useState, useCallback } from 'react';
import type { OcelLogTs, EvidenceTs, EvidenceState } from '@wasm4pm/types';

export const useOcelEvidence = () => {
  const [evidence, setEvidence] = useState<EvidenceTs<OcelLogTs, EvidenceState, string> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const loadEvidence = useCallback(async () => {
    setIsLoading(true);
    try {
      const mockLog: OcelLogTs = {
        objects: [
          {
            id: 'obj_1',
            object_type: 'Order',
            attributes: [{ key: 'value', value: { type: 'Float', value: 100.5 } }],
          },
        ],
        events: [
          {
            id: 'evt_1',
            activity: 'Create Order',
            timestamp_ns: BigInt(Date.now()) * BigInt(1000000),
            attributes: [],
          },
        ],
        e2o: [{ event_id: 'evt_1', object_id: 'obj_1', qualifier: 'main' }],
        o2o: [],
        changes: [],
      };

      const admitted: EvidenceTs<OcelLogTs, EvidenceState, string> = {
        value: mockLog,
        _state: 'Admitted',
        _witness: 'Ocel20',
      };

      setEvidence(admitted);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { evidence, isLoading, loadEvidence };
};
