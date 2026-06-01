import { ApprovalFlowManager } from '../manager';
import { createGovernanceInterceptor } from '../interceptor';
import { InterceptorContext, MembraneConfig } from '../../types';

describe('Decentralized State Governance', () => {
  let manager: ApprovalFlowManager;
  const mockConfig: MembraneConfig = { mode: 'strict' };

  beforeEach(() => {
    manager = new ApprovalFlowManager();
  });

  it('should identify high-tension mutations based on configuration', () => {
    manager.registerConfig({
      id: 'high-value-transfer',
      capabilityPattern: 'vault.transfer',
      tensionPredicate: (input) => input.amount > 1000,
      steps: [{ id: 'admin', label: 'Admin Approval' }],
    });

    expect(manager.findMatchingConfig('vault.transfer', { amount: 500 })).toBeUndefined();
    expect(manager.findMatchingConfig('vault.transfer', { amount: 1500 })).toBeDefined();
    expect(manager.findMatchingConfig('other.cap', { amount: 1500 })).toBeUndefined();
  });

  it('should initiate an approval flow via interceptor', async () => {
    manager.registerConfig({
      id: 'test-flow',
      capabilityPattern: /test\..+/,
      tensionPredicate: () => true,
      steps: [{ id: 'step1', label: 'Step 1' }],
    });

    const interceptor = createGovernanceInterceptor(manager);
    const ctx: InterceptorContext = {
      commandId: 'cmd_123',
      capabilityId: 'test.mutation',
      input: { foo: 'bar' },
      config: mockConfig,
    };

    const result = await interceptor(ctx);
    expect(result).toBe(false); // Should deny immediate execution

    const pending = manager.getPendingRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0].commandId).toBe('cmd_123');
    expect(pending[0].status).toBe('pending');
    expect(pending[0].steps[0].status).toBe('pending');
  });

  it('should support multi-step verification and hooks', async () => {
    const onRequested = jest.fn();
    const onStep = jest.fn();
    const onResolved = jest.fn();

    manager.registerHook({
      onVerificationRequested: onRequested,
      onStepCompleted: onStep,
      onVerificationResolved: onResolved,
    });

    manager.registerConfig({
      id: 'multi-step',
      capabilityPattern: 'cap',
      tensionPredicate: () => true,
      steps: [
        { id: 's1', label: 'L1' },
        { id: 's2', label: 'L2' },
      ],
    });

    const ctx: InterceptorContext = {
      commandId: 'c1',
      capabilityId: 'cap',
      input: {},
      config: mockConfig,
    };

    const request = await manager.initiateApproval(ctx);
    expect(onRequested).toHaveBeenCalledWith(request);

    await manager.completeStep(request.id, 's1', 'user_a');
    expect(onStep).toHaveBeenCalledWith(request, 's1');
    expect(request.status).toBe('pending');

    await manager.completeStep(request.id, 's2', 'user_b');
    expect(onResolved).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect(request.status).toBe('approved');
  });

  it('should handle rejections', async () => {
    manager.registerConfig({
      id: 'flow',
      capabilityPattern: 'cap',
      tensionPredicate: () => true,
      steps: [{ id: 's1', label: 'L1' }],
    });

    const request = await manager.initiateApproval({
      commandId: 'c1',
      capabilityId: 'cap',
      input: {},
      config: mockConfig,
    });

    await manager.rejectRequest(request.id, 'policy violation');
    expect(request.status).toBe('rejected');
    expect(request.steps[0].status).toBe('rejected');
  });

  it('should throw error when initiating approval for unconfigured capability', async () => {
    await expect(
      manager.initiateApproval({
        commandId: 'c1',
        capabilityId: 'unconfigured',
        input: {},
        config: mockConfig,
      })
    ).rejects.toThrow('No approval flow configured');
  });

  it('should handle non-existent requests or steps gracefully', async () => {
    await expect(manager.completeStep('non-existent', 's1', 'user')).rejects.toThrow('not found');

    manager.registerConfig({
      id: 'f',
      capabilityPattern: 'c',
      tensionPredicate: () => true,
      steps: [{ id: 's1', label: 'L' }],
    });
    const req = await manager.initiateApproval({
      commandId: 'c1',
      capabilityId: 'c',
      input: {},
      config: mockConfig,
    });

    await expect(manager.completeStep(req.id, 'invalid-step', 'user')).rejects.toThrow('not found');
  });

  it('should not allow double completion of the same step', async () => {
    manager.registerConfig({
      id: 'f',
      capabilityPattern: 'c',
      tensionPredicate: () => true,
      steps: [{ id: 's1', label: 'L' }],
    });
    const req = await manager.initiateApproval({
      commandId: 'c1',
      capabilityId: 'c',
      input: {},
      config: mockConfig,
    });

    await manager.completeStep(req.id, 's1', 'user1');
    const firstCompletionTime = req.steps[0].completedAt;

    await manager.completeStep(req.id, 's1', 'user2');
    expect(req.steps[0].completedBy).toBe('user1');
    expect(req.steps[0].completedAt).toBe(firstCompletionTime);
  });
});
