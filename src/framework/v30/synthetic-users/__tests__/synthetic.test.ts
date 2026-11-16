import { SyntheticPopulationEngine, LocalLLMStub } from '../SyntheticPopulation';

describe('SyntheticPopulation', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1000000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('LocalLLMStub', () => {
    it('should generate profiles correctly with varying seeds', () => {
      const stub = new LocalLLMStub();
      const p1 = stub.generateProfile(0);
      expect(p1.name).toBe('Alice');
      expect(p1.behavioralPattern).toBe('aggressive');
      expect(p1.activityLevel).toBe(0);

      const p2 = stub.generateProfile(1);
      expect(p2.name).toBe('Bob');
      expect(p2.behavioralPattern).toBe('passive');
      expect(p2.activityLevel).toBe(0.01);

      const p3 = stub.generateProfile(2);
      expect(p3.name).toBe('Charlie');
      expect(p3.behavioralPattern).toBe('sporadic');

      const p4 = stub.generateProfile(3);
      expect(p4.behavioralPattern).toBe('consistent');
    });

    it('should generate interaction streams based on aggressive pattern', () => {
      const stub = new LocalLLMStub();
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // constant random
      const p1 = stub.generateProfile(0); // aggressive
      const stream = stub.generateInteractionStream(p1, 2);

      expect(stream).toHaveLength(2);
      expect(stream[0].action).toBe('login');
      expect(stream[0].durationMs).toBe(150); // 50 + 0.5 * 200 = 150
      expect(stream[1].action).toBe('click');
    });

    it('should generate interaction streams based on passive pattern', () => {
      const stub = new LocalLLMStub();
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // constant random
      const p = stub.generateProfile(1); // passive
      const stream = stub.generateInteractionStream(p, 2);

      expect(stream).toHaveLength(2);
      expect(stream[0].durationMs).toBe(3500); // 1000 + 0.5 * 5000 = 3500
    });
  });
});
