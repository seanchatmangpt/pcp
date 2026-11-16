import { sha256, canonicalStringify } from '../../crypto/receipts';

/**
 * 1. Truex Verification Fixture
 */
const session_id = 'session-2030-prod';
const expected_path_hash = '9bf9bdfa89101030e2f9d854cfec56116ced11394c8e7e126bb67f781a0fa2e8';

const ocel2 = {
  event_log: {
    events: [
      {
        id: 'e1',
        activity: 'PublishSermon',
        timestamp: '2026-05-23T10:00:00Z',
        omap: ['sermon-1'],
      },
      {
        id: 'e2',
        activity: 'SendNotification',
        timestamp: '2026-05-23T10:05:00Z',
        omap: ['sermon-1'],
      },
    ],
    objects: [{ id: 'sermon-1', type: 'CreativeWork', attributes: { title: 'Vision 2030' } }],
  },
};

const ocel2_batch_hash = sha256(canonicalStringify(ocel2));
const receiptSeed = `${session_id}:${ocel2_batch_hash}:${expected_path_hash}`;
const receipt_hash = sha256(receiptSeed);

export const truexVerificationFixture = {
  session_id,
  expected_path_hash,
  ocel2_batch_hash,
  receipt_hash,
  admission_status: 'accepted',
  ocel2,
};

/**
 * 2. JTBD Conformance Fixture
 */
export const jtbdConformanceFixture = {
  declaredWorkflow: ['PublishSermon', 'SendNotification', 'VerifyFeed', 'ArchiveRecord'],
  truthfulTrace: ['PublishSermon', 'SendNotification', 'VerifyFeed', 'ArchiveRecord'],
  deviantTrace: [
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    'UpdateDatabase',
    'ArchiveRecord',
  ],
};

/**
 * 3. Concept Drift Fixture
 */
export const conceptDriftFixture = {
  stableActivities: [
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
  ],
  driftingActivities: [
    // Stable phase (Windows 0 and 1)
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    // Drift phase (Windows 2, 3 and 4 have 100% distinct activities)
    'TriggerAutoAuditor',
    'UpdateDatabase',
    'ArchiveRecord',
    'RenderOutput',
    'UploadMedia',
    'TrackProgress',
    'CheckCompliance',
    'PrintReport',
    'ExportExcel',
  ],
};

/**
 * 4. RL Orchestration Fixture
 */
export const rlOrchestratorFixture = {
  cyclesCount: 30,
};

/**
 * 5. Compliance Guard Fixture
 */
export const complianceGuardFixture = {
  compliantTrace: [
    {
      id: 'c1',
      actorKind: 'Sermon',
      actorId: 'abc123',
      command: 'PublishSermon',
      status: 'applied_local',
    },
    {
      id: 'c2',
      actorKind: 'Sermon',
      actorId: 'abc123',
      command: 'SendNotification',
      status: 'applied_local',
    },
  ],
  nonCompliantTrace: [
    {
      id: 'c1',
      actorKind: 'Sermon',
      actorId: 'abc123',
      command: 'PublishSermon',
      status: 'rejected_remote',
    },
    {
      id: 'c2',
      actorKind: 'Sermon',
      actorId: 'abc123',
      command: 'SendNotification',
      status: 'applied_local',
    },
  ],
};
