/// <reference types="jest" />

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock database module globally to prevent native SQLite instantiation in non-db tests
const mockDbInstance = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => []),
        })),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => Promise.resolve()),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve()),
  })),
};

const mockDbModule = {
  DATABASE_NAME: '@truex/membrane-client.db',
  expoDb: {
    execSync: jest.fn(),
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  },
  db: mockDbInstance,
};

jest.mock('@/src/lib/db/db', () => mockDbModule, { virtual: true });
jest.mock('<rootDir>/src/lib/db/db', () => mockDbModule, { virtual: true });
jest.mock('../lib/db/db', () => mockDbModule, { virtual: true });
jest.mock('../../lib/db/db', () => mockDbModule, { virtual: true });
jest.mock('../../../lib/db/db', () => mockDbModule, { virtual: true });

// Mock expo-router
jest.mock('expo-router', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };
  const React = require('react');
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: any) => {
      React.useEffect(effect, [effect]);
    },
    Stack: (() => {
      const MockStack = ({ children }: any) => children;
      const MockScreen = jest.fn(({ options }: any) => {
        const Right = options?.headerRight;
        const Left = options?.headerLeft;
        return React.createElement(
          React.Fragment,
          null,
          typeof Right === 'function' ? Right() : Right,
          typeof Left === 'function' ? Left() : Left
        );
      });
      MockStack.Screen = MockScreen;
      MockStack.AvatarRelativeProjection = MockScreen;
      MockStack.Protected = ({ children }: any) => children;
      return MockStack;
    })(),
    Tabs: (() => {
      const MockTabs = ({ children }: any) => children;
      const MockScreen = jest.fn();
      MockTabs.Screen = MockScreen;
      MockTabs.AvatarRelativeProjection = MockScreen;
      return MockTabs;
    })(),
  };
});

// Mock React Navigation
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock Worklets
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('View', props),
  };
});

// Mock react-native-mmkv globally
jest.mock('react-native-mmkv', () => {
  const instances: Record<string, any> = {};
  const createInstance = (options?: { id?: string }) => {
    const id = options?.id || 'default';
    if (!instances[id]) {
      const store: Record<string, string> = {};
      instances[id] = {
        id,
        set: jest.fn((key: string, val: string | boolean | number) => {
          store[key] = val.toString();
        }),
        getString: jest.fn((key: string) => {
          return store[key] !== undefined ? store[key] : undefined;
        }),
        getBoolean: jest.fn((key: string) => {
          return store[key] !== undefined ? store[key] === 'true' : undefined;
        }),
        getNumber: jest.fn((key: string) => {
          return store[key] !== undefined ? parseFloat(store[key]) : undefined;
        }),
        getAllKeys: jest.fn(() => Object.keys(store)),
        delete: jest.fn((key: string) => {
          delete store[key];
        }),
        remove: jest.fn((key: string) => {
          delete store[key];
        }),
        clearAll: jest.fn(() => {
          for (const key in store) delete store[key];
        }),
        addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
        _store: store,
      };
    }
    return instances[id];
  };

  return {
    MMKV: jest.fn().mockImplementation((options) => createInstance(options)),
    createMMKV: jest.fn((options) => createInstance(options)),
  };
});

// Mock drizzle-orm/expo-sqlite globally
jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => []),
          })),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => Promise.resolve()),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve()),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    })),
  })),
}));

// Mock expo-sqlite globally
jest.mock('expo-sqlite', () => {
  const mockDb = {
    execSync: jest.fn(),
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
  const mockExpoSQLite = {
    openDatabaseSync: jest.fn(() => mockDb),
    openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
    NativeDatabase: jest.fn().mockImplementation(function() {
      return mockDb;
    }),
    SQLiteDatabase: jest.fn().mockImplementation(function() {
      return mockDb;
    }),
  };
  return {
    ...mockExpoSQLite,
    default: mockExpoSQLite,
  };
});

// Mock project supabase client globally
const mockSingle = jest.fn();
const mockUpsert = jest.fn();
const mockSignOut = jest.fn();
const mockSupabaseChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: mockSingle,
  upsert: mockUpsert,
};
const mockSupabaseClient = {
  supabase: {
    from: jest.fn(() => mockSupabaseChain),
    auth: {
      signOut: mockSignOut,
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
};

jest.mock('@/lib/supabase', () => mockSupabaseClient, { virtual: true });
jest.mock('../../lib/supabase', () => mockSupabaseClient, { virtual: true });

//// Mock Zustand Actor Ops Store globally
const mockSetNetworkOnline = jest.fn();
const mockSetRemoteRejectActive = jest.fn();
const mockSetLatestReceipt = jest.fn();
const mockSetLatestEvent = jest.fn();
const mockSetCounts = jest.fn();
const mockSetCurrentPrincipal = jest.fn();
const mockSetPacketDropRate = jest.fn();
const mockSetCdcEventsCount = jest.fn();

const mockIsNetworkOffline = jest.fn();
const mockSetNetworkOffline = jest.fn();
const mockIsRemoteRejectionMocked = jest.fn();
const mockSetRemoteRejectionMocked = jest.fn();
const mockGetCurrentPrincipal = jest.fn();
const mockGetPacketDropRate = jest.fn();
const mockSetPacketDropRateHelper = jest.fn();

let mockLatestReceipt: any = { id: 'mock-rec-id' };

const mockActorOpsState = {
  _networkOnline: true,
  get networkOnline() {
    return (global as any).mockNetworkOnline !== undefined ? (global as any).mockNetworkOnline : this._networkOnline;
  },
  set networkOnline(val) {
    this._networkOnline = val;
    if ((global as any).mockNetworkOnline !== undefined) {
      (global as any).mockNetworkOnline = val;
    }
  },
  remoteRejectActive: false,
  latestReceipt: mockLatestReceipt,
  latestEvent: null as string | null,
  outboxCount: 0,
  quarantineCount: 0,
  packetDropRate: 0,
  cdcEventsCount: 0,
  currentPrincipal: { id: 'usr_admin', role: 'admin' },
  setNetworkOnline: mockSetNetworkOnline,
  setRemoteRejectActive: mockSetRemoteRejectActive,
  setCurrentPrincipal: mockSetCurrentPrincipal,
  setLatestReceipt: mockSetLatestReceipt,
  setLatestEvent: mockSetLatestEvent,
  setCounts: mockSetCounts,
  setPacketDropRate: mockSetPacketDropRate,
  setCdcEventsCount: mockSetCdcEventsCount,
};

const mockUseActorOpsStore = jest.fn((selector: any) => {
  if (typeof selector === 'function') {
    return selector(mockActorOpsState);
  }
  return mockActorOpsState;
});

(mockUseActorOpsStore as any).getState = jest.fn(() => mockActorOpsState);

(mockUseActorOpsStore as any).setState = jest.fn((patch) => {
  if (typeof patch === 'function') {
    Object.assign(mockActorOpsState, patch(mockActorOpsState));
  } else {
    Object.assign(mockActorOpsState, patch);
  }
  if (mockActorOpsState.latestReceipt !== undefined) {
    mockLatestReceipt = mockActorOpsState.latestReceipt;
  }
});


const mockPushChanges = jest.fn(() => Promise.resolve());
const mockSyncEngine = {
  pushChanges: mockPushChanges,
};

const mockGlobalLocalDispatcher = {
  syncOutbox: jest.fn(() => Promise.resolve()),
  dispatch: jest.fn(() => Promise.resolve()),
  getSyncEngine: jest.fn(() => mockSyncEngine),
};

const mockGlobalRemoteDispatcher = {
  dispatch: jest.fn(() => Promise.resolve()),
};

const mockGlobalSyncEngine = {
  sync: jest.fn(() => Promise.resolve()),
};

const mockGlobalVkgClient = {
  match: jest.fn(() => Promise.resolve([])),
  add: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  execute: jest.fn(() => Promise.resolve()),
};

// Expose mock modules globally so tests can access them
(global as any).__mockUseActorOpsStore = mockUseActorOpsStore;
(global as any).__mockGlobalLocalDispatcher = mockGlobalLocalDispatcher;
(global as any).__mockGlobalRemoteDispatcher = mockGlobalRemoteDispatcher;
(global as any).__mockGlobalSyncEngine = mockGlobalSyncEngine;
(global as any).__mockGlobalVkgClient = mockGlobalVkgClient;
(global as any).__mockIsNetworkOffline = mockIsNetworkOffline;
(global as any).__mockSetNetworkOffline = mockSetNetworkOffline;
(global as any).__mockIsRemoteRejectionMocked = mockIsRemoteRejectionMocked;
(global as any).__mockSetRemoteRejectionMocked = mockSetRemoteRejectionMocked;
(global as any).__mockGetCurrentPrincipal = mockGetCurrentPrincipal;
(global as any).__mockSetCurrentPrincipal = mockSetCurrentPrincipal;
(global as any).__mockGetPacketDropRate = mockGetPacketDropRate;
(global as any).__mockSetPacketDropRateHelper = mockSetPacketDropRateHelper;

// Also expose general expected mocks for tests that check global mock properties directly
(global as any).mockNetworkOnline = true;
(global as any).mockRemoteRejectActive = false;
(global as any).mockSetNetworkOnline = mockSetNetworkOnline;
(global as any).mockSetRemoteRejectActive = mockSetRemoteRejectActive;
(global as any).mockSetLatestReceipt = mockSetLatestReceipt;
(global as any).mockSetLatestEvent = mockSetLatestEvent;
(global as any).mockSetCounts = mockSetCounts;

function mockFactory() {
  return {
    useActorOpsStore: (global as any).__mockUseActorOpsStore,
    globalLocalDispatcher: (global as any).__mockGlobalLocalDispatcher,
    globalRemoteDispatcher: (global as any).__mockGlobalRemoteDispatcher,
    globalSyncEngine: (global as any).__mockGlobalSyncEngine,
    globalVkgClient: (global as any).__mockGlobalVkgClient,
    isNetworkOffline: (global as any).__mockIsNetworkOffline,
    setNetworkOffline: (global as any).__mockSetNetworkOffline,
    isRemoteRejectionMocked: (global as any).__mockIsRemoteRejectionMocked,
    setRemoteRejectionMocked: (global as any).__mockSetRemoteRejectionMocked,
    getCurrentPrincipal: (global as any).__mockGetCurrentPrincipal,
    setCurrentPrincipal: (global as any).__mockSetCurrentPrincipal,
    getPacketDropRate: (global as any).__mockGetPacketDropRate,
    setPacketDropRate: (global as any).__mockSetPacketDropRateHelper,
  };
}

jest.mock('@/src/lib/actor/actorOps', () => mockFactory(), { virtual: true });
jest.mock('../lib/actor/actorOps', () => mockFactory(), { virtual: true });
jest.mock('../../lib/actor/actorOps', () => mockFactory(), { virtual: true });
jest.mock('../../../lib/actor/actorOps', () => mockFactory(), { virtual: true });

function setupMockImplementations() {
  mockSetNetworkOnline.mockImplementation((online) => {
    if ((global as any).mockNetworkOnline !== undefined) {
      (global as any).mockNetworkOnline = online;
    }
    mockActorOpsState._networkOnline = online;
  });

  mockSetRemoteRejectActive.mockImplementation((active) => {
    mockActorOpsState.remoteRejectActive = active;
  });

  mockSetLatestReceipt.mockImplementation((r) => {
    mockLatestReceipt = r;
    mockActorOpsState.latestReceipt = r;
  });

  mockSetCounts.mockImplementation((outbox, quarantine) => {
    mockActorOpsState.outboxCount = outbox;
    mockActorOpsState.quarantineCount = quarantine;
  });

  mockIsNetworkOffline.mockImplementation(() => !mockActorOpsState.networkOnline);

  mockSetNetworkOffline.mockImplementation((val) => {
    mockActorOpsState.networkOnline = !val;
    (mockUseActorOpsStore as any).setState({ networkOnline: !val });
  });

  mockIsRemoteRejectionMocked.mockImplementation(() => mockActorOpsState.remoteRejectActive);

  mockSetRemoteRejectionMocked.mockImplementation((val) => {
    mockActorOpsState.remoteRejectActive = val;
    (mockUseActorOpsStore as any).setState({ remoteRejectActive: val });
  });

  mockGetCurrentPrincipal.mockImplementation(() => mockActorOpsState.currentPrincipal);

  mockSetCurrentPrincipal.mockImplementation((p) => {
    mockActorOpsState.currentPrincipal = p;
    (mockUseActorOpsStore as any).setState({ currentPrincipal: p });
  });

  mockSetPacketDropRate.mockImplementation((rate) => {
    mockActorOpsState.packetDropRate = rate;
  });

  mockSetCdcEventsCount.mockImplementation((count) => {
    mockActorOpsState.cdcEventsCount = count;
  });

  mockGetPacketDropRate.mockImplementation(() => mockActorOpsState.packetDropRate);

  mockSetPacketDropRateHelper.mockImplementation((rate) => {
    mockActorOpsState.packetDropRate = rate;
    (mockUseActorOpsStore as any).setState({ packetDropRate: rate });
  });

  mockSetPacketDropRate.mockImplementation((rate) => {
    mockActorOpsState.packetDropRate = rate;
  });

  mockSetCdcEventsCount.mockImplementation((count) => {
    mockActorOpsState.cdcEventsCount = count;
  });
}

// Initial setup of implementations
setupMockImplementations();

// Global reset helper to isolate test runs
beforeEach(() => {
  // Reset Zustand state
  Object.assign(mockActorOpsState, {
    _networkOnline: true,
    remoteRejectActive: false,
    currentPrincipal: { id: 'usr_admin', role: 'admin' },
    latestReceipt: null,
    latestEvent: null,
    outboxCount: 0,
    quarantineCount: 0,
    packetDropRate: 0,
    cdcEventsCount: 0,
  });

  if ((global as any).mockNetworkOnline !== undefined) {
    delete (global as any).mockNetworkOnline;
  }

  // Reset all mock implementations and call history to prevent leakage
  mockSetNetworkOnline.mockReset();
  mockSetRemoteRejectActive.mockReset();
  mockSetCurrentPrincipal.mockReset();
  mockSetLatestReceipt.mockReset();
  mockSetLatestEvent.mockReset();
  mockSetCounts.mockReset();
  mockIsNetworkOffline.mockReset();
  mockSetNetworkOffline.mockReset();
  mockIsRemoteRejectionMocked.mockReset();
  mockSetRemoteRejectionMocked.mockReset();
  mockSetPacketDropRate.mockReset();
  mockSetCdcEventsCount.mockReset();
  mockGetPacketDropRate.mockReset();
  mockSetPacketDropRateHelper.mockReset();

  // Reapply default implementations
  setupMockImplementations();
});

