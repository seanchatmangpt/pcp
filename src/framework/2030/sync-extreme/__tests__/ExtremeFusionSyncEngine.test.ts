import { ExtremeFusionSyncEngine } from '../ExtremeFusionSyncEngine';
import { SyncExtremeMode } from '../types';
import { SatelliteSyncAdapter } from '../adapters/SatelliteSyncAdapter';
import { LoRaSyncAdapter } from '../adapters/LoRaSyncAdapter';
import { QuantumSyncAdapter } from '../adapters/QuantumSyncAdapter';

// Mocks
const mockStandardEngine = {
  queueJob: jest.fn().mockResolvedValue({}),
  pushChanges: jest.fn().mockResolvedValue({}),
} as any;

const mockMeshEngine = {
  getAdapter: jest.fn().mockReturnValue({
    onMessage: jest.fn(),
    broadcast: jest.fn(),
    getLocalPeerId: jest.fn().mockReturnValue('peer-1'),
  }),
} as any;

const mockCompression = {
  compress: jest.fn().mockImplementation((s) => Promise.resolve(`compressed_${s}`)),
  decompress: jest.fn().mockImplementation((s) => Promise.resolve(s.replace('compressed_', ''))),
} as any;

const mockWorkspace = {
  receiveUpdate: jest.fn(),
  crdtState: { data: 'test-state' },
} as any;

describe('ExtremeFusionSyncEngine', () => {
  let engine: ExtremeFusionSyncEngine<any>;
  let satelliteAdapter: SatelliteSyncAdapter;
  let loraAdapter: LoRaSyncAdapter;
  let quantumAdapter: QuantumSyncAdapter;

  beforeEach(() => {
    jest.clearAllMocks();

    satelliteAdapter = new SatelliteSyncAdapter();
    loraAdapter = new LoRaSyncAdapter();
    quantumAdapter = new QuantumSyncAdapter();

    engine = new ExtremeFusionSyncEngine({
      standardEngine: mockStandardEngine,
      meshEngine: mockMeshEngine,
      compression: mockCompression,
      satelliteAdapter,
      loraAdapter,
      quantumAdapter,
    });

    // Mock getWorkspace to return our mock workspace
    jest.spyOn(engine, 'getWorkspace').mockReturnValue(mockWorkspace);
  });

  it('should initialize with all adapters and setup listeners', () => {
    const status = engine.getExtremeStatus();
    expect(status.satellite).toBe('connected');
    expect(status.lora).toBe('degraded');
    expect(status.quantum).toBe('connected');
  });

  it('should broadcast to all extreme adapters when syncExtreme is called', async () => {
    const spySat = jest.spyOn(satelliteAdapter, 'broadcast');
    const spyLora = jest.spyOn(loraAdapter, 'broadcast');
    const spyQuantum = jest.spyOn(quantumAdapter, 'broadcast');

    await engine.syncExtreme('test-workspace');

    expect(spySat).toHaveBeenCalledWith('test-workspace', expect.stringContaining('compressed_'));
    expect(spyLora).toHaveBeenCalledWith('test-workspace', expect.stringContaining('compressed_'));
    expect(spyQuantum).toHaveBeenCalledWith(
      'test-workspace',
      expect.stringContaining('compressed_')
    );
  });

  it('should process incoming updates from extreme adapters', async () => {
    const compressedPayload = 'compressed_{"data":"new-state"}';

    // Simulate incoming satellite update
    satelliteAdapter.simulateIncomingUpdate('test-workspace', compressedPayload);

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockWorkspace.receiveUpdate).toHaveBeenCalledWith({ data: 'new-state' });
  });

  it('should handle decompression errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockCompression.decompress.mockRejectedValueOnce(new Error('Decompression failed'));

    satelliteAdapter.simulateIncomingUpdate('test-workspace', 'invalid-payload');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ExtremeFusionSyncEngine] Failed to process satellite update:'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should return disconnected status for missing adapters', () => {
    const minimalEngine = new ExtremeFusionSyncEngine({
      standardEngine: mockStandardEngine,
      meshEngine: mockMeshEngine,
      compression: mockCompression,
    });

    const status = minimalEngine.getExtremeStatus();
    expect(status.satellite).toBe('disconnected');
    expect(status.lora).toBe('disconnected');
    expect(status.quantum).toBe('disconnected');
  });
});
