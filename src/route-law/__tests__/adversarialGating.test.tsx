import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ProtectedRoute } from '../ProtectedRoute';
import ProcessScreen from '../../../apps/template-app/src/app/(tabs)/process';

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

// Mock @/context/SessionProvider
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
    set: jest.fn(),
    addOnValueChangedListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  };
  return {
    mmkvInstance: mockMmkvInstance,
    createIsolatedMMKVStorage: jest.fn(() => ({
      storage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      instance: mockMmkvInstance,
    })),
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

// Mock useOcelEvidence hook
jest.mock('../../hooks/useOcelEvidence', () => {
  const mockUseOcelEvidence = jest.fn();
  return {
    useOcelEvidence: mockUseOcelEvidence,
  };
});

describe('Adversarial Gating Verification', () => {
  let mockRouter: any;
  let mockUseSession: any;
  let mockUseActorOpsStore: any;
  let mockMmkvInstance: any;
  let mockUseOcelEvidence: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRouter = require('expo-router')._mockRouter;
    mockUseSession = require('../../../context/SessionProvider').useSession;
    mockUseActorOpsStore = require('../../lib/actor/actorOps')._mockUseActorOpsStore;
    mockMmkvInstance = require('../../lib/store/mmkvStorage').mmkvInstance;
    mockUseOcelEvidence = require('../../hooks/useOcelEvidence').useOcelEvidence;

    mockUseSession.mockReturnValue({
      session: null,
      loading: false,
      isTransitioning: false,
    });
    mockUseActorOpsStore.mockReturnValue({
      latestReceipt: null,
    });
    mockUseOcelEvidence.mockReturnValue({
      evidence: { _state: 'Admitted', _witness: 'Ocel20', value: { objects: [], events: [] } },
      isLoading: false,
      loadEvidence: jest.fn(),
    });
    mockMmkvInstance.getString.mockReturnValue(undefined);
    mockMmkvInstance.addOnValueChangedListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  describe('1. Gating Bypass Vulnerability in Quarantined Route (/process)', () => {
    it('blocks an authenticated but unverified user without any receipts from accessing /process (redirects)', async () => {
      // User is only authenticated (not verified, not mfa_verified)
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'unverified@example.com',
          },
        },
        loading: false,
      });

      // No receipts present
      mockMmkvInstance.getString.mockReturnValue(undefined);

      // Render ProcessScreen directly (simulating deep link access)
      const { queryByText, getByText } = render(<ProcessScreen />);

      // The Process Intelligence header should NOT render
      expect(queryByText('PROCESS INTELLIGENCE')).toBeNull();
      
      // The user should be redirected
      await waitFor(() => {
        expect(getByText('Redirecting to /')).toBeTruthy();
      });
    });

    it('blocks a verified user without cmd_process_access receipt from accessing /process (Admission Refused)', async () => {
      // User is verified
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'verified@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // No receipts present
      mockMmkvInstance.getString.mockReturnValue(undefined);

      // Render ProcessScreen directly
      const { queryByText, getByText } = render(<ProcessScreen />);

      // The Process Intelligence header should NOT render
      expect(queryByText('PROCESS INTELLIGENCE')).toBeNull();
      
      // The Admission Refused blocking screen should render
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
      });
    });
  });

  describe('2. Receipt Gating Cryptographic Signature Verification Bypass', () => {
    it('blocks a completely fake/unsigned receipt for cmd_openai_access because gating verifies cryptographic signatures', async () => {
      // User is verified (meets boundary constraint for /openai)
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'verified@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // Inject a completely fake/unsigned receipt with only a matching commandId
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_openai_access') {
          return JSON.stringify({
            commandId: 'cmd_openai_access',
            // No signature, no valid fields
          });
        }
        return undefined;
      });

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: 'cmd_openai_access',
          }}
        >
          <Text>OpenAI Chat Content</Text>
        </ProtectedRoute>
      );

      expect(queryByText('OpenAI Chat Content')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('blocks a completely fake/unsigned receipt for cmd_audit_access because gating verifies cryptographic signatures', async () => {
      // User is mfa_verified (meets boundary constraint)
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'mfa@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
            amr: ['mfa'],
          },
        },
        loading: false,
      });

      // Inject a completely fake/unsigned receipt with only a matching commandId
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_audit_access') {
          return JSON.stringify({
            commandId: 'cmd_audit_access',
          });
        }
        return undefined;
      });

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'mfa_verified',
            requiredReceiptCommandId: 'cmd_audit_access',
          }}
        >
          <Text>Audit Dashboard Content</Text>
        </ProtectedRoute>
      );

      // It should NOT show the children content and show Admission Refused blocking screen
      expect(queryByText('Audit Dashboard Content')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('blocks a completely fake/unsigned receipt for cmd_process_access because gating verifies cryptographic signatures', async () => {
      // User is verified
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'verified@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // Inject a completely fake/unsigned receipt with only a matching commandId
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_process_access') {
          return JSON.stringify({
            commandId: 'cmd_process_access',
          });
        }
        return undefined;
      });

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: 'cmd_process_access',
          }}
        >
          <Text>Process Content</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Process Content')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('blocks a receipt with invalid cryptographic signature coordinates for cmd_openai_access', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'verified@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // Inject a receipt with malformed signature coordinates (not on curve/out of bounds)
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_openai_access') {
          return JSON.stringify({
            commandId: 'cmd_openai_access',
            signature: { r: '0', s: '123456' },
            publicKey: { x: '9999999999', y: '9999999999' },
          });
        }
        return undefined;
      });

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: 'cmd_openai_access',
          }}
        >
          <Text>OpenAI Chat Content</Text>
        </ProtectedRoute>
      );

      expect(queryByText('OpenAI Chat Content')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('blocks a receipt with invalid cryptographic signature coordinates for cmd_audit_access', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'mfa@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
            amr: ['mfa'],
          },
        },
        loading: false,
      });

      // Inject a receipt with malformed signature coordinates
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_audit_access') {
          return JSON.stringify({
            commandId: 'cmd_audit_access',
            signature: { r: '12345', s: '0' },
            publicKey: { x: '111', y: '222' },
          });
        }
        return undefined;
      });

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'mfa_verified',
            requiredReceiptCommandId: 'cmd_audit_access',
          }}
        >
          <Text>Audit Dashboard Content</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Audit Dashboard Content')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('blocks a receipt with invalid cryptographic signature coordinates for cmd_process_access', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: {
            id: 'usr_1',
            email: 'verified@example.com',
            email_confirmed_at: '2026-01-01T00:00:00Z',
          },
        },
        loading: false,
      });

      // Inject a receipt with malformed signature coordinates
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_process_access') {
          return JSON.stringify({
            commandId: 'cmd_process_access',
            signature: { r: '123456789', s: '123456789' },
            publicKey: { x: '1', y: '2' },
          });
        }
        return undefined;
      });

      const { queryByText, getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: 'cmd_process_access',
          }}
        >
          <Text>Process Content</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Process Content')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });
  });
});

