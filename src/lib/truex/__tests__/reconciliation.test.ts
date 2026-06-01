import { HookReceipt } from '../hook-otp/types';

interface ReconciliationAuditLog {
  localReceiptId: string;
  remoteReceiptHash?: string;
  status: 'Pending' | 'Confirmed' | 'Refused';
  timestamp: string;
}

class ClientReconciler {
  public auditLogs = new Map<string, ReconciliationAuditLog>();

  public createPending(messageId: string): string {
    const localId = 'local_run_' + messageId;
    this.auditLogs.set(localId, {
      localReceiptId: localId,
      status: 'Pending',
      timestamp: new Date().toISOString(),
    });
    return localId;
  }

  public reconcile(localId: string, remoteHash: string, admitted: boolean) {
    const existing = this.auditLogs.get(localId);
    if (!existing) {
      throw new Error(`Lineage mismatch: local receipt not found: ${localId}`);
    }
    
    // Update and preserve lineage
    this.auditLogs.set(localId, {
      ...existing,
      remoteReceiptHash: remoteHash,
      status: admitted ? 'Confirmed' : 'Refused',
      timestamp: new Date().toISOString(),
    });
  }
}

describe('Truex Client/Server Reconciliation Engine', () => {
  let reconciler: ClientReconciler;

  beforeEach(() => {
    reconciler = new ClientReconciler();
  });

  test('should settle authoritative receipt and preserve lineage (server admitted)', () => {
    const msgId = 'msg-recon-100';
    const localId = reconciler.createPending(msgId);
    
    expect(reconciler.auditLogs.get(localId)?.status).toBe('Pending');
    expect(reconciler.auditLogs.get(localId)?.remoteReceiptHash).toBeUndefined();

    // Reconcile with server confirmation
    const remoteHash = 'signed_server_receipt_hash_abc';
    reconciler.reconcile(localId, remoteHash, true);

    const record = reconciler.auditLogs.get(localId);
    expect(record?.status).toBe('Confirmed');
    expect(record?.remoteReceiptHash).toBe(remoteHash);
    expect(record?.localReceiptId).toBe(localId); // Lineage preserved!
  });

  test('should settle authoritative receipt and preserve lineage (server refused)', () => {
    const msgId = 'msg-recon-200';
    const localId = reconciler.createPending(msgId);
    
    expect(reconciler.auditLogs.get(localId)?.status).toBe('Pending');

    // Reconcile with server rejection/refusal
    const remoteHash = 'refused_server_receipt_hash_xyz';
    reconciler.reconcile(localId, remoteHash, false);

    const record = reconciler.auditLogs.get(localId);
    expect(record?.status).toBe('Refused');
    expect(record?.remoteReceiptHash).toBe(remoteHash);
    expect(record?.localReceiptId).toBe(localId); // Lineage preserved!
  });
});
