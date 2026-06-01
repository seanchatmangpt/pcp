import { LWWRegister } from '../register';

describe('LWWRegister', () => {
  it('should initialize with value', () => {
    const reg = new LWWRegister('peer1', 'initial');
    expect(reg.value).toBe('initial');
  });

  it('should update value', () => {
    const reg = new LWWRegister('peer1', 'initial');
    reg.set('updated');
    expect(reg.value).toBe('updated');
  });

  it('should merge higher timestamp', () => {
    const reg1 = new LWWRegister('peer1', 'v1', 100);
    const reg2State = { value: 'v2', timestamp: 200, peerId: 'peer2' };

    reg1.merge(reg2State);
    expect(reg1.value).toBe('v2');
  });

  it('should not merge lower timestamp', () => {
    const reg1 = new LWWRegister('peer1', 'v1', 200);
    const reg2State = { value: 'v2', timestamp: 100, peerId: 'peer2' };

    reg1.merge(reg2State);
    expect(reg1.value).toBe('v1');
  });

  it('should tie-break with peerId on equal timestamp', () => {
    const reg1 = new LWWRegister('a', 'v1', 100);
    const reg2State = { value: 'v2', timestamp: 100, peerId: 'b' };

    reg1.merge(reg2State);
    expect(reg1.value).toBe('v2'); // 'b' > 'a'

    const reg3State = { value: 'v3', timestamp: 100, peerId: '0' };
    reg1.merge(reg3State);
    expect(reg1.value).toBe('v2'); // 'b' > '0'
  });

  it('should ensure monotonicity on local set', () => {
    const reg = new LWWRegister('peer1', 'v1', 100);
    reg.set('v2', 50); // Try to set with lower timestamp
    expect(reg.state.timestamp).toBeGreaterThan(100);
    expect(reg.value).toBe('v2');
  });
});
