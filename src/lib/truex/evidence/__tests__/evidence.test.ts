import { HookReceipt, HookActorRef } from '../../hook-otp/types';
import { exportToOcel, importFromOcel, exportToOcelTs, importFromOcelTs } from '../ocel';
import { computeDiff } from '../diff';
import { compressMessageLog } from '../compression';
import { toReceiptShapeTs } from '../receipts';

describe('Truex Evidence & OCEL Runtime', () => {
  const actorRef: HookActorRef = {
    tenantId: 't1',
    packId: 'p1',
    hookId: 'h1',
    instanceId: 'inst-1',
  };

  const dummyReceipts: HookReceipt[] = [
    {
      receiptHash: 'hash-r1',
      previousReceiptHash: 'init',
      hookRunId: 'run-r1',
      tenantId: 't1',
      actorRef,
      messageId: 'msg-r1',
      inputHash: 'in-1',
      outputHash: 'out-1',
      deltaHash: 'del-1',
      status: 'Confirmed',
      avatarProjectionHashes: {},
      supervisorEvents: [],
      timestamp: new Date().toISOString(),
    },
  ];

  test('should export and import OCEL format correctly', () => {
    const ocelLog = exportToOcel(dummyReceipts);
    expect(ocelLog.events.length).toBe(1);
    expect(ocelLog.events[0].id).toBe('run-r1');

    const imported = importFromOcel(ocelLog);
    expect(imported.length).toBe(1);
    expect(imported[0].receiptHash).toBe('hash-r1');
  });

  test('should export and import OCEL TS format correctly', () => {
    const ocelLogTs = exportToOcelTs(dummyReceipts);
    expect(ocelLogTs.events.length).toBe(1);
    expect(ocelLogTs.events[0].id).toBe('run-r1');
    expect(ocelLogTs.objects.length).toBe(1);
    expect(ocelLogTs.e2o.length).toBe(1);

    const imported = importFromOcelTs(ocelLogTs);
    expect(imported.length).toBe(1);
    expect(imported[0].receiptHash).toBe('hash-r1');
  });


  test('should generate structured state diff reports', () => {
    const stateA = { a: 1, b: { c: 'hello' } };
    const stateB = { a: 2, b: { c: 'hello' } };
    const stateC = { a: 1, b: { c: 'world' } };

    const diff1 = computeDiff(stateA, stateB);
    expect(diff1.diverged).toBe(true);
    expect(diff1.mismatches.length).toBe(1);
    expect(diff1.mismatches[0].path).toBe('a');
    expect(diff1.mismatches[0].expected).toBe(1);
    expect(diff1.mismatches[0].observed).toBe(2);

    const diff2 = computeDiff(stateA, stateC);
    expect(diff2.diverged).toBe(true);
    expect(diff2.mismatches[0].path).toBe('b.c');
  });

  test('should compress event/message logs', () => {
    const messages: any[] = [
      { id: 'm1', correlationId: 'c1' },
      { id: 'm2', correlationId: 'c1' },
      { id: 'm3', correlationId: 'c2' },
    ];

    const compressed = compressMessageLog(messages);
    expect(compressed.length).toBe(2);
    expect(compressed[0].id).toBe('m1');
    expect(compressed[1].id).toBe('m3');
  });

  test('should map HookReceipt to ReceiptShapeTs successfully', () => {
    const receiptTs = toReceiptShapeTs(dummyReceipts[0]);
    expect(receiptTs.case_id).toBe('run-r1');
    expect(receiptTs.process_hash).toBe('hash-r1');
    expect(receiptTs.parent_block_hash).toBe('init');
    expect(receiptTs.fitness).toBe(1.0);
  });
});
