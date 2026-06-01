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

    it('should generate interaction streams based on sporadic/consistent pattern (default fallback)', () => {
      const stub = new LocalLLMStub();
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // constant random
      const p = stub.generateProfile(2); // sporadic
      const stream = stub.generateInteractionStream(p, 1);

      expect(stream[0].durationMs).toBe(550); // 100 + 0.5 * 900 = 550
    });

    it('should handle isNaN actionIndex gracefully', () => {
      const stub = new LocalLLMStub();
      const p = stub.generateProfile(0);
      p.activityLevel = NaN; // Break calculation

      const stream = stub.generateInteractionStream(p, 1);
      expect(stream[0].action).toBe('click');
    });

    it('should handle negative actionIndex gracefully', () => {
      const stub = new LocalLLMStub();
      const p = stub.generateProfile(0);
      p.activityLevel = -2; // Force negative

      const stream = stub.generateInteractionStream(p, 1);
      expect(stream[0].action).toBe('click');
    });
  });

  describe('SyntheticPopulationEngine', () => {
    let engine: SyntheticPopulationEngine;

    beforeEach(() => {
      engine = new SyntheticPopulationEngine();
      jest.useFakeTimers();
    });

    afterEach(() => {
      engine.stopBackgroundSimulation();
      jest.useRealTimers();
    });

    it('should spawn profiles', () => {
      const profiles = engine.spawnProfiles(5);
      expect(profiles.length).toBe(5);
      expect(engine.getProfiles().length).toBe(5);
    });

    it('should handle background simulation start and stop with default arguments', () => {
      engine.spawnProfiles(2);
      engine.startBackgroundSimulation(); // default args

      jest.advanceTimersByTime(1000); // default interval 1000ms
      expect(engine.getCacheSize()).toBeGreaterThan(0);

      engine.stopBackgroundSimulation();
    });

    it('should handle background simulation start and stop with specific arguments', () => {
      engine.spawnProfiles(2);
      expect(engine.getCacheSize()).toBe(0);

      engine.startBackgroundSimulation(2, 100);
      // Starting twice should be no-op
      engine.startBackgroundSimulation(2, 100);

      jest.advanceTimersByTime(100);
      expect(engine.getCacheSize()).toBeGreaterThan(0);

      engine.stopBackgroundSimulation();
      const sizeBefore = engine.getCacheSize();
      jest.advanceTimersByTime(100);
      expect(engine.getCacheSize()).toBe(sizeBefore);

      // Stopping twice should be fine
      engine.stopBackgroundSimulation();
    });

    it('should simulate tick safely when no profiles exist', () => {
      engine.simulateTick(); // default args
      expect(engine.getCacheSize()).toBe(0);
    });

    it('should simulate tick with profiles and trigger callbacks', () => {
      engine.spawnProfiles(2);
      const callback = jest.fn();
      engine.setInteractionCallback(callback);

      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Predictable burst
      engine.simulateTick(); // default args

      expect(engine.getCacheSize()).toBeGreaterThan(0);
      expect(callback).toHaveBeenCalled();
    });

    it('should simulate tick without callback without errors', () => {
      engine.spawnProfiles(1);
      engine.simulateTick(1);
      expect(engine.getCacheSize()).toBeGreaterThan(0);
    });

    it('should allow clearing the cache', () => {
      engine.spawnProfiles(1);
      engine.simulateTick(1);
      expect(engine.getCacheSize()).toBeGreaterThan(0);
      engine.clearCache();
      expect(engine.getCacheSize()).toBe(0);
    });
  });
});
