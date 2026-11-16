import { GCounter, PNCounter } from '../counter';

describe('GCounter', () => {
  it('should initialize at 0', () => {
    const counter = new GCounter('p1');
    expect(counter.value).toBe(0);
  });

  it('should increment', () => {
    const counter = new GCounter('p1');
    counter.increment(5);
    expect(counter.value).toBe(5);
  });

  it('should merge correctly', () => {
    const c1 = new GCounter('p1');
    c1.increment(2);

    const c2State = { p1: 1, p2: 5 };
    c1.merge(c2State);

    expect(c1.value).toBe(7); // max(2, 1) + 5
  });
});
