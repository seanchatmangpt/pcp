import { Membrane } from '../../../../membrane/membrane';
import {
  AdversarialCodeMutator,
  PrototypePollutionDefender,
  ASTInjectionDefender,
} from '../mutator';

describe('Adversarial Code Mutator Test Rig', () => {
  let membrane: Membrane;
  let mutator: AdversarialCodeMutator;

  beforeEach(() => {
    membrane = new Membrane({ mode: 'strict' });
    mutator = new AdversarialCodeMutator(membrane);

    membrane.trajectories.registerFlow('AuthFlow', {
      INIT: ['PENDING'],
      PENDING: ['AUTHORIZED', 'DENIED'],
    });
  });

  afterEach(() => {
    membrane.interceptors.clear();
  });

  describe('With Defenders Active (Pre-execution Gate)', () => {
    beforeEach(() => {
      membrane.interceptors.register(PrototypePollutionDefender);
      membrane.interceptors.register(ASTInjectionDefender);
    });

    it('proves the Membrane catches and isolates Prototype Pollution', async () => {
      const result = await mutator.attackPrototypePollution('cmd_pollute_1', '__proto__.admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Denied by membrane');
      expect(result.receipt.verdict).toBe('deny');

      // Confirm that the system is unpolluted
      expect(({} as any).admin).toBeUndefined();
    });

    it('proves the Membrane catches and isolates AST Injection', async () => {
      const maliciousNode = { type: 'CallExpression', callee: 'eval', arguments: [] };
      const result = await mutator.attackASTInjection('cmd_ast_1', maliciousNode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Denied by membrane');
      expect(result.receipt.verdict).toBe('deny');
    });

    it('proves the Membrane catches and isolates Type-Law Violations', async () => {
      // Attempt illegal transition INIT -> AUTHORIZED
      const result = await mutator.attackTypeLawViolation(
        'cmd_typelaw_1',
        'AuthFlow',
        'INIT',
        'AUTHORIZED'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Illegal trajectory transition');

      // Membrane isolates illegal state transitions into Quarantine
      const quarantined = membrane.quarantine.getRecords();
      expect(quarantined.length).toBe(1);
      expect(quarantined[0].commandId).toBe('cmd_typelaw_1');
      expect(quarantined[0].error).toContain('Illegal state transition');
    });
  });
});
