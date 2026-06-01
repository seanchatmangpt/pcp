import { renderHook } from '@testing-library/react-native';
import { useAalstStream } from '../useAalstStream';

describe('useAalstStream', () => {
  it('initializes correctly and connects with final logs', () => {
    const { result } = renderHook(() => useAalstStream());
    expect(result.current.isConnected).toBe(true);
    expect(result.current.logs.length).toBe(3);
    expect(result.current.logs[0].id).toBe('final-petri');
    expect(result.current.logs[1].id).toBe('final-metrics');
    expect(result.current.logs[2].id).toBe('broadcast-status');
  });

  it('contains the Van der Aalst certification in telemetry', () => {
    const { result } = renderHook(() => useAalstStream());
    const telemetry = result.current.logs.find((l) => l.type === 'OCEL_TELEMETRY');
    expect(telemetry?.payload).toBe('BROADCAST ACTIVE - VAN DER AALST CERTIFIED');
  });

  it('contains final petri net state with CERTIFIED place', () => {
    const { result } = renderHook(() => useAalstStream());
    const petri = result.current.logs.find((l) => l.type === 'PETRI_NET');
    const payload = JSON.parse(petri?.payload || '{}');
    expect(payload.places).toContainEqual({ id: 'CERTIFIED', tokens: 1 });
  });
});
