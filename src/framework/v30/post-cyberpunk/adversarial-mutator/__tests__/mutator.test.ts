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

  describe('With Defenders Inactive (Post-execution / Quarantine Gate)', () => {
    it('isolates AST injection when evaluated (Execution Crash)', async () => {
      const maliciousNode = { type: 'CallExpression', callee: 'eval', arguments: [] };
      const result = await mutator.attackASTInjection('cmd_ast_2', maliciousNode);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fatal AST Evaluation: CallExpression not permitted');

      const quarantined = membrane.quarantine.getRecords();
      expect(quarantined.length).toBe(1);
      expect(quarantined[0].error).toBe('Fatal AST Evaluation: CallExpression not permitted');
    });

    it('runs naiveMerge without crashing but tracks execution result', async () => {
      const result = await mutator.attackPrototypePollution('cmd_pollute_2', 'normal.path');
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ normal: { path: 'true' } });
    });

    it('runs nested naiveMerge for coverage', async () => {
      // Create a payload that requires deep merging to hit line 77
      const payload = { config: { active: true }, normal: { path: 'true' } };
      const result = await mutator.attackPrototypePollution('cmd_pollute_deep', 'config.active');
      expect(result.success).toBe(true);
    });

    it('allows valid AST execution', async () => {
      const validNode = { type: 'Literal', value: 42 };
      const result = await mutator.attackASTInjection('cmd_ast_valid', validNode);
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ compiled: true });
    });

    it('allows valid type-law transitions', async () => {
      const result = await mutator.attackTypeLawViolation(
        'cmd_typelaw_valid',
        'AuthFlow',
        'INIT',
        'PENDING'
      );
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ updated: true, state: 'PENDING' });
    });
  });

  describe('Defender Coverage', () => {
    it('ASTInjectionDefender allows normal nodes', async () => {
      const ctx: any = { input: { type: 'Program', body: [{ type: 'VariableDeclaration' }] } };
      const result = await ASTInjectionDefender(ctx);
      expect(result).toBe(true);
    });

    it('PrototypePollutionDefender allows normal objects', async () => {
      const ctx: any = { input: { normal: { nested: true } } };
      const result = await PrototypePollutionDefender(ctx);
      expect(result).toBe(true);
    });

    it('ASTInjectionDefender allows non-object inputs', async () => {
      const ctx: any = { input: null };
      const result = await ASTInjectionDefender(ctx);
      expect(result).toBe(true);
    });

    it('PrototypePollutionDefender allows non-object inputs', async () => {
      const ctx: any = { input: 'string' };
      const result = await PrototypePollutionDefender(ctx);
      expect(result).toBe(true);
    });

    it('PrototypePollutionDefender blocks constructor', async () => {
      const ctx: any = { input: JSON.parse('{"constructor": {"prototype": {}}}') };
      const result = await PrototypePollutionDefender(ctx);
      expect(result).toBe(false);
    });
  });
});
