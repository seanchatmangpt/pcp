import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ProtectedRoute } from '../ProtectedRoute';
import { AdminShell } from '../../components/admin/AdminShell';

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
  };
  return {
    useRouter: () => mockRouter,
    Redirect: jest.fn(({ href }) => {
      mockRouter.replace(href);
      return React.createElement(Text, null, `Redirecting to ${href}`);
    }),
    _mockRouter: mockRouter,
  };
});

// Mock ../../../context/SessionProvider
jest.mock('../../../context/SessionProvider', () => {
  const mockUseSession = jest.fn();
  return {
    useSession: mockUseSession,
  };
});

// Mock ../../lib/actor/actorOps
jest.mock('../../lib/actor/actorOps', () => {
  const mockUseActorOpsStore = jest.fn();
  return {
    useActorOpsStore: (selector: any) => selector(mockUseActorOpsStore()),
    _mockUseActorOpsStore: mockUseActorOpsStore,
  };
});

// Mock ../../lib/store/mmkvStorage
jest.mock('../../lib/store/mmkvStorage', () => {
  const mockMmkvInstance = {
    getString: jest.fn(),
    addOnValueChangedListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  };
  return {
    mmkvInstance: mockMmkvInstance,
  };
});

// Mock SQLite db which is loaded dynamically in ProtectedRoute
jest.mock('../../lib/db/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../lib/db/schema', () => ({
  actorReceipts: {
    commandId: 'commandId',
  },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

jest.mock('../../lib/crypto/receipts', () => {
  const actual = jest.requireActual('../../lib/crypto/receipts');
  return {
    ...actual,
    verifyEcdsaSignature: jest.fn().mockReturnValue({ valid: true }),
  };
});

describe('Gating and Routing Protection Tests', () => {
  let mockRouter: any;
  let mockUseSession: any;
  let mockUseActorOpsStore: any;
  let mockMmkvInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Retrieve mocks from module registry
    const expoRouterMock = require('expo-router');
    mockRouter = expoRouterMock._mockRouter;

    mockUseSession = require('../../../context/SessionProvider').useSession;
    mockUseSession.mockReturnValue({
      session: null,
      loading: false,
      isTransitioning: false,
    });

    const actorOpsMock = require('../../lib/actor/actorOps');
    mockUseActorOpsStore = actorOpsMock._mockUseActorOpsStore;
    mockUseActorOpsStore.mockReturnValue({
      latestReceipt: null,
    });

    const mmkvMock = require('../../lib/store/mmkvStorage');
    mockMmkvInstance = mmkvMock.mmkvInstance;
    mockMmkvInstance.getString.mockReturnValue(undefined);
    mockMmkvInstance.addOnValueChangedListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  describe('1. Route Clearance & Gating Checks', () => {
    it('blocks anonymous users attempting to access authenticated /(tabs) layout', () => {
      mockUseSession.mockReturnValue({
        session: null,
        loading: false,
        isTransitioning: false,
      });

      const { queryByText } = render(
        <ProtectedRoute route={{ requiredIdentityBoundary: 'authenticated' }}>
          <Text>Tab Content</Text>
        </ProtectedRoute>
      );

      // Child component should not render
      expect(queryByText('Tab Content')).toBeNull();
      // Should redirect to auth stack
      expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)');
    });

    it('blocks unauthorized users attempting to access admin routes (requires verified identity)', () => {
      // User is authenticated but email/phone is not confirmed (only has 'authenticated' level)
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'test@example.com',
            // No email_confirmed_at or phone_confirmed_at
          },
        },
        loading: false,
      });

      const { queryByText } = render(
        <ProtectedRoute route={{ requiredIdentityBoundary: 'verified' }}>
          <Text>Admin Dashboard</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Admin Dashboard')).toBeNull();
      // Should redirect to root home tab (since it is code INSUFFICIENT_IDENTITY_LEVEL)
      expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });

    it('allows access to admin routes if user is verified', () => {
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'test@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      const { queryByText } = render(
        <ProtectedRoute route={{ requiredIdentityBoundary: 'verified' }}>
          <Text>Admin Dashboard</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Admin Dashboard')).toBeTruthy();
    });
  });

  describe('2. Admin Shell Back Button Behavior', () => {
    it('goes back using router.back() when history is present', () => {
      mockRouter.canGoBack.mockReturnValue(true);

      const { getByTestId } = render(
        <AdminShell title="Admin Title">
          <Text>Admin Screen</Text>
        </AdminShell>
      );

      const backBtn = getByTestId('admin-back-btn');
      fireEvent.press(backBtn);

      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('redirects / replaces route to /(tabs) when NO history is present', () => {
      mockRouter.canGoBack.mockReturnValue(false);

      const { getByTestId } = render(
        <AdminShell title="Admin Title">
          <Text>Admin Screen</Text>
        </AdminShell>
      );

      const backBtn = getByTestId('admin-back-btn');
      fireEvent.press(backBtn);

      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  describe('3. Deep Linking Gating to Quarantined Routes', () => {
    it('blocks deep linking to /openai if user lacks the cmd_openai_access receipt proof', async () => {
      // User is verified (meets identity boundary constraint)
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'test@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // No receipt stored in MMKV
      mockMmkvInstance.getString.mockReturnValue(undefined);

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: 'cmd_openai_access',
          }}
        >
          <Text>OpenAI Chat</Text>
        </ProtectedRoute>
      );

      // Verify that children are NOT rendered
      expect(queryByText('OpenAI Chat')).toBeNull();

      // Verify that blocking screen showing Admission Refused is displayed
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
      });
    });

    it('allows deep linking to /openai if user has valid cmd_openai_access receipt proof in MMKV', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'test@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // Valid receipt returned from MMKV
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_openai_access') {
          return JSON.stringify({
            commandId: 'cmd_openai_access',
            deltaHash: 'blake3_hash_xyz',
            signature: { r: '123', s: '456' },
            publicKey: { x: '789', y: '101' },
          });
        }
        return undefined;
      });

      const { getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: 'cmd_openai_access',
          }}
        >
          <Text>OpenAI Chat</Text>
        </ProtectedRoute>
      );

      // OpenAI Chat should be visible
      await waitFor(() => {
        expect(getByText('OpenAI Chat')).toBeTruthy();
      });
    });

    it('blocks deep linking to /audit if user is not MFA verified', () => {
      // User is verified but NOT mfa_verified
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'test@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
            // No mfa factors
          },
        },
        loading: false,
      });

      const { queryByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'mfa_verified',
            requiredReceiptCommandId: 'cmd_audit_access',
          }}
        >
          <Text>Audit Dashboard</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Audit Dashboard')).toBeNull();
      // Should redirect to root home tab (since it is code INSUFFICIENT_IDENTITY_LEVEL)
      expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });
  });
});
