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
});
