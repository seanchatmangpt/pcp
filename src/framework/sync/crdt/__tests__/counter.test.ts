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

  it('should throw on negative increment', () => {
    const counter = new GCounter('p1');
    expect(() => counter.increment(-1)).toThrow();
  });
});

describe('PNCounter', () => {
  it('should initialize at 0', () => {
    const counter = new PNCounter('p1');
    expect(counter.value).toBe(0);
  });

  it('should increment and decrement', () => {
    const counter = new PNCounter('p1');
    counter.increment(10);
    counter.decrement(3);
    expect(counter.value).toBe(7);
  });

  it('should merge correctly', () => {
    const c1 = new PNCounter('p1');
    c1.increment(10); // p1: {p:10, n:0}

    const c2State = {
      p: { p1: 5, p2: 5 },
      n: { p1: 0, p2: 2 },
    };

    c1.merge(c2State);
    // p1 now has p: {p1: 10, p2: 5}, n: {p1: 0, p2: 2}
    // value = (10+5) - (0+2) = 13
    expect(c1.value).toBe(13);
  });
});
