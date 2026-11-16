import { Membrane } from '../../../membrane/membrane';
import { AgentNativeInterface } from '../interface';
import {
  LogGenerator,
  TokenReplayConformanceChecker,
  AgentNativeOcel2Event,
} from '../process-mining';
import { SemanticCommand } from '../types';

describe('AgentNativeInterface Process Mining & Conformance Checking Suite', () => {
  let membrane: Membrane;
  let logGenerator: LogGenerator;
  let checker: TokenReplayConformanceChecker;
  let agentInterface: AgentNativeInterface;
  let initialState: any;

  const validZkp = {
    claimId: 'claim_pm_101',
    proofData: JSON.stringify({
      pi_a: ['11883344556677889900112233', '22883344556677889900112233', '1'],
      pi_b: [
        ['33883344556677889900112233', '44883344556677889900112233'],
        ['55883344556677889900112233', '66883344556677889900112233'],
        ['1', '0'],
      ],
      pi_c: ['77883344556677889900112233', '88883344556677889900112233', '1'],
    }),
    publicSignals: ['1'],
    enclaveSignature: '0x1234567890123456789012345678901234567890ab',
  };

  beforeEach(() => {
    membrane = new Membrane({ mode: 'strict' });
    logGenerator = new LogGenerator();
    checker = new TokenReplayConformanceChecker();
    initialState = {
      value: 42,
    };
    agentInterface = new AgentNativeInterface(membrane, initialState, {
      enforceZkp: true,
      membraneId: 'pm-test-membrane',
      logGenerator,
    });
  });

  describe('OCEL 2.0 Compliance Logging', () => {
    it('optionally emits OCEL 2.0 events for the dispatch lifecycle and records them in the log generator', async () => {
      const command: SemanticCommand = {
        id: 'cmd_pm_1',
        action: 'ping',
        params: {},
        zkp: validZkp,
      };

      const result = await agentInterface.dispatch(command);
      expect(result.success).toBe(true);

      const ocelLog = logGenerator.getLog();

      // Verify objects
      expect(ocelLog.objects.length).toBeGreaterThanOrEqual(4); // Command, Membrane, Proof, Receipt
      const commandObj = ocelLog.objects.find((obj) => obj.id === 'cmd_pm_1');
      expect(commandObj).toBeDefined();
      expect(commandObj?.type).toBe('command');
      expect(commandObj?.attributes.action).toBe('ping');

      const membraneObj = ocelLog.objects.find((obj) => obj.id === 'pm-test-membrane');
      expect(membraneObj).toBeDefined();
      expect(membraneObj?.type).toBe('membrane');

      const receiptObj = ocelLog.objects.find((obj) => obj.id === result.receiptId);
      expect(receiptObj).toBeDefined();
      expect(receiptObj?.type).toBe('receipt');
      expect(receiptObj?.attributes.verdict).toBe('allow');

      // Verify events and activities
      expect(ocelLog.events.length).toBe(4);
      expect(ocelLog.events[0].activity).toBe('EnqueueCommand');
      expect(ocelLog.events[1].activity).toBe('VerifyZkp');
      expect(ocelLog.events[2].activity).toBe('CheckAttestation');
      expect(ocelLog.events[3].activity).toBe('BindReceipt');

      // Verify omap relationships
      expect(ocelLog.events[0].omap).toContain('cmd_pm_1');
      expect(ocelLog.events[0].omap).toContain('pm-test-membrane');
      expect(ocelLog.events[1].omap).toContain('cmd_pm_1');
      expect(ocelLog.events[1].omap).toContain(validZkp.claimId);
      expect(ocelLog.events[3].omap).toContain('cmd_pm_1');
      expect(ocelLog.events[3].omap).toContain(result.receiptId);
    });

    it('verifies that absolute markdown links are used in deviation warnings or logging comments', () => {
      const deviantTrace: AgentNativeOcel2Event[] = [
        { id: '1', activity: 'EnqueueCommand', timestamp: '', omap: [], vmap: {} },
        // VerifyZkp is skipped
        { id: '2', activity: 'CheckAttestation', timestamp: '', omap: [], vmap: {} },
        { id: '3', activity: 'BindReceipt', timestamp: '', omap: [], vmap: {} },
      ];

      const res = checker.checkTrace(deviantTrace);
      expect(res.isConforming).toBe(false);
      expect(res.deviations.length).toBeGreaterThan(0);

      // Verify that deviation strings contain absolute markdown links (with file:/// protocol)
      for (const dev of res.deviations) {
        expect(dev).toMatch(/\[.*\]\(file:\/\/\/Users\/sac\/pcpapp\/.*\)/);
      }
    });
  });

  describe('Token-Game Replay Conformance Checker', () => {
    it('verifies that a valid execution trace yields perfect fitness of 1.0', async () => {
      const command: SemanticCommand = {
        id: 'cmd_pm_2',
        action: 'ping',
        params: {},
        zkp: validZkp,
      };

      await agentInterface.dispatch(command);
      const trace = logGenerator.getLog().events;

      const res = checker.checkTrace(trace);
      expect(res.isConforming).toBe(true);
      expect(res.fitness).toBe(1.0);
      expect(res.missingTokens).toBe(0);
      expect(res.remainingTokens).toBe(0);
    });
  });
});
