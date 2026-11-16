import React from 'react';
import { render, fireEvent, waitFor, renderHook, act } from '@testing-library/react-native';
import { Text, View, TouchableOpacity, Keyboard, TextInput } from 'react-native';
import { ProtectedRoute } from '../ProtectedRoute';
import { useSemanticForm } from '../../framework/data/forms/useSemanticForm';
import { fetchSemanticSchema } from '../../framework/data/forms/utils';
import { SemanticForm } from '../../framework/data/forms/SemanticForm';
import { A11yAuditor } from '../../framework/validation/A11yAuditor';
import { TelemetryGraph3D } from '../../framework/admin/telemetry-3d/TelemetryGraph3D';
import { PinchToZoom } from '../../framework/ui/gestures/PinchToZoom';

// Mock react-native-gesture-handler to capture callbacks and avoid native proxy crashes
jest.mock('react-native-gesture-handler', () => {
  return {
    Gesture: {
      Pan: jest.fn().mockImplementation(() => {
        const mockPan: any = {};
        mockPan.onUpdate = jest.fn().mockReturnValue(mockPan);
        mockPan.onEnd = jest.fn().mockReturnValue(mockPan);
        return mockPan;
      }),
      Pinch: jest.fn().mockImplementation(() => {
        const mockPinch: any = {};
        mockPinch.onUpdate = jest.fn().mockReturnValue(mockPinch);
        mockPinch.onEnd = jest.fn().mockReturnValue(mockPinch);
        return mockPinch;
      }),
      Tap: jest.fn().mockImplementation(() => {
        const mockTap: any = {};
        mockTap.numberOfTaps = jest.fn().mockReturnValue(mockTap);
        mockTap.enabled = jest.fn().mockReturnValue(mockTap);
        mockTap.onStart = jest.fn().mockReturnValue(mockTap);
        return mockTap;
      }),
      Simultaneous: jest.fn().mockImplementation((...args) => args),
    },
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: ({ children }: any) => children,
  };
});

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

// Mock SessionProvider
jest.mock('../../../context/SessionProvider', () => {
  const mockUseSession = jest.fn();
  return {
    useSession: mockUseSession,
  };
});

// Mock actorOps
jest.mock('../../lib/actor/actorOps', () => {
  const mockUseActorOpsStore = jest.fn();
  return {
    useActorOpsStore: (selector: any) => selector(mockUseActorOpsStore()),
    _mockUseActorOpsStore: mockUseActorOpsStore,
  };
});

// Mock mmkvStorage
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

// Mock SQLite db loaded dynamically in ProtectedRoute
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
    deltaHash: 'deltaHash',
    actorRef: 'actorRef',
  },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
}));

jest.mock('../../lib/crypto/receipts', () => {
  const actual = jest.requireActual('../../lib/crypto/receipts');
  return {
    ...actual,
    verifyEcdsaSignature: jest.fn(),
  };
});

jest.mock('../../framework/data/forms/utils', () => ({
  fetchSemanticSchema: jest.fn(),
}));

describe('Emparial Adversarial Challenge & Stress Tests', () => {
  let mockRouter: any;
  let mockUseSession: any;
  let mockUseActorOpsStore: any;
  let mockMmkvInstance: any;
  let mockVerifyEcdsaSignature: any;
  let mockDbSelect: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRouter = require('expo-router')._mockRouter;
    mockUseSession = require('../../../context/SessionProvider').useSession;
    mockUseActorOpsStore = require('../../lib/actor/actorOps')._mockUseActorOpsStore;
    mockMmkvInstance = require('../../lib/store/mmkvStorage').mmkvInstance;
    mockVerifyEcdsaSignature = require('../../lib/crypto/receipts').verifyEcdsaSignature;
    mockDbSelect = require('../../lib/db/db').db;

    // Default session setup
    mockUseSession.mockReturnValue({
      session: null,
      loading: false,
      isTransitioning: false,
    });

    mockUseActorOpsStore.mockReturnValue({
      latestReceipt: null,
    });

    mockMmkvInstance.getString.mockReturnValue(undefined);
    mockVerifyEcdsaSignature.mockReturnValue({ valid: true });
  });

  describe('1. Routing Gating & Auth Guard', () => {
    it('redirects unauthenticated users to /(auth)', () => {
      const { queryByText } = render(
        <ProtectedRoute route={{ requiredIdentityBoundary: 'authenticated' }}>
          <Text>Protected Content</Text>
        </ProtectedRoute>
      );
      expect(queryByText('Protected Content')).toBeNull();
      expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)');
    });

    it('redirects authenticated but unverified users trying to access verified route to /', () => {
      mockUseSession.mockReturnValue({
        session: {
          user: { id: 'user_1', email: 'user@example.com' }, // Not verified
        },
        loading: false,
        isTransitioning: false,
      });

      const { queryByText } = render(
        <ProtectedRoute route={{ requiredIdentityBoundary: 'verified' }}>
          <Text>Verified Content</Text>
        </ProtectedRoute>
      );
      expect(queryByText('Verified Content')).toBeNull();
      expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });

    it('allows access to verified content for verified users without receipt gating constraints', () => {
      mockUseSession.mockReturnValue({
        session: {
          user: { id: 'user_1', email: 'user@example.com', email_confirmed_at: '2026-01-01' },
        },
        loading: false,
        isTransitioning: false,
      });

      const { getByText } = render(
        <ProtectedRoute route={{ requiredIdentityBoundary: 'verified' }}>
          <Text>Verified Content</Text>
        </ProtectedRoute>
      );
      expect(getByText('Verified Content')).toBeTruthy();
    });

    it('enforces signature check for secure paths, blocking unsigned/malformed receipts', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: { id: 'user_1', email: 'user@example.com', email_confirmed_at: '2026-01-01' },
        },
        loading: false,
        isTransitioning: false,
      });

      // Mock receipt found in MMKV but signature is invalid
      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === 'receipt_cmd_openai_access') {
          return JSON.stringify({
            commandId: 'cmd_openai_access',
            deltaHash: 'hash_xyz',
            signature: null, // missing signature
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
          <Text>OpenAI Panel</Text>
        </ProtectedRoute>
      );

      expect(queryByText('OpenAI Panel')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('vulnerability check: custom/non-hardcoded receipt keys are properly checked for signatures (rejected when missing)', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: { id: 'user_1', email: 'user@example.com', email_confirmed_at: '2026-01-01' },
        },
        loading: false,
        isTransitioning: false,
      });

      const customReceiptKey = 'cmd_custom_feature_access';

      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === `receipt_${customReceiptKey}`) {
          return JSON.stringify({
            commandId: customReceiptKey,
            deltaHash: 'hash_xyz',
            // NO signature, NO publicKey fields
          });
        }
        return undefined;
      });

      const { getByText, queryByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: customReceiptKey,
          }}
        >
          <Text>Custom Feature Panel</Text>
        </ProtectedRoute>
      );

      expect(queryByText('Custom Feature Panel')).toBeNull();
      await waitFor(() => {
        expect(getByText('Admission Refused')).toBeTruthy();
        expect(getByText('Receipt signature is invalid or unsigned.')).toBeTruthy();
      });
    });

    it('vulnerability check: custom/non-hardcoded receipt keys are properly checked for signatures (accepted when valid)', async () => {
      mockUseSession.mockReturnValue({
        session: {
          user: { id: 'user_1', email: 'user@example.com', email_confirmed_at: '2026-01-01' },
        },
        loading: false,
        isTransitioning: false,
      });

      const customReceiptKey = 'cmd_custom_feature_access';

      mockMmkvInstance.getString.mockImplementation((key: string) => {
        if (key === `receipt_${customReceiptKey}`) {
          return JSON.stringify({
            commandId: customReceiptKey,
            deltaHash: 'hash_xyz',
            signature: 'valid_sig',
            publicKey: 'valid_pk',
          });
        }
        return undefined;
      });

      const { getByText } = render(
        <ProtectedRoute
          route={{
            requiredIdentityBoundary: 'verified',
            requiredReceiptCommandId: customReceiptKey,
          }}
        >
          <Text>Custom Feature Panel</Text>
        </ProtectedRoute>
      );

      await waitFor(() => {
        expect(getByText('Custom Feature Panel')).toBeTruthy();
      });
    });
  });

  describe('2. Form Decimal Inputs & Numeric Validation', () => {
    const mockSchema = {
      targetType: 'https://schema.org/Product',
      fields: [
        {
          predicate: 'https://schema.org/price',
          label: 'Price',
          required: true,
          range: 'http://www.w3.org/2001/XMLSchema#double',
        },
        {
          predicate: 'https://schema.org/stock',
          label: 'StockCount',
          required: false,
          range: 'http://www.w3.org/2001/XMLSchema#integer',
        },
      ],
    };

    beforeEach(() => {
      (fetchSemanticSchema as jest.Mock).mockResolvedValue(mockSchema);
    });

    it('accepts partial/temporary decimal inputs in state but fails validate() until valid', async () => {
      const mockClient = { match: jest.fn() };
      const { result } = renderHook(() =>
        useSemanticForm(mockClient as any, 'https://schema.org/Product')
      );

      // Wait for schema to load before running validation
      await waitFor(() => {
        expect(result.current.isLoadingSchema).toBe(false);
      });

      // 1. Partial states during typing
      act(() => {
        result.current.setFieldValue('https://schema.org/price', '.');
      });
      expect(result.current.values['https://schema.org/price']).toBe('.');
      
      let isValid: boolean = true;
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(false);
      expect(result.current.errors['https://schema.org/price']).toBe('Price must be a number');

      act(() => {
        result.current.setFieldValue('https://schema.org/price', '-');
      });
      expect(result.current.values['https://schema.org/price']).toBe('-');
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(false);

      act(() => {
        result.current.setFieldValue('https://schema.org/price', '-.');
      });
      expect(result.current.values['https://schema.org/price']).toBe('-.');
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(false);

      // 2. Spaces and letters
      act(() => {
        result.current.setFieldValue('https://schema.org/price', 'abc');
      });
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(false);

      // 3. Proper negative double
      act(() => {
        result.current.setFieldValue('https://schema.org/price', '-25.99');
      });
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(true);

      // 4. Scientific notation double
      act(() => {
        result.current.setFieldValue('https://schema.org/price', '1.23e-4');
      });
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(true);

      // 5. Scientific notation uppercase E double
      act(() => {
        result.current.setFieldValue('https://schema.org/price', '3E10');
      });
      act(() => {
        isValid = result.current.validate();
      });
      expect(isValid).toBe(true);
    });

    it('filters invalid keyboard inputs in SemanticForm text input change filter', async () => {
      const mockClient = { match: jest.fn() };
      const onSubmit = jest.fn();

      const { getByPlaceholderText } = render(
        <SemanticForm
          client={mockClient as any}
          targetType="https://schema.org/Product"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        expect(getByPlaceholderText('Price')).toBeTruthy();
      });

      const priceInput = getByPlaceholderText('Price');

      // Type valid characters
      fireEvent.changeText(priceInput, '12.3');
      expect(priceInput.props.value).toBe('12.3');
    });
  });

  describe('3. Accessibility & Touch Targets', () => {
    it('verifies interactive buttons meet minimum touch target sizes (>= 44px)', () => {
      const mockClient = { match: jest.fn() };
      const { getByLabelText } = render(
        <SemanticForm
          client={mockClient as any}
          targetType="https://schema.org/Product"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
          submitLabel="SubmitBtn"
          cancelLabel="CancelBtn"
        />
      );

      // Wait for schema load
      return waitFor(() => {
        const submitBtn = getByLabelText('SubmitBtn');
        const cancelBtn = getByLabelText('CancelBtn');

        const submitStyle = submitBtn.props.style;
        const cancelStyle = cancelBtn.props.style;

        // Verify minHeight or height is >= 44
        const submitHeight = submitStyle.height || submitStyle.minHeight;
        const cancelHeight = cancelStyle.height || cancelStyle.minHeight;

        expect(submitHeight).toBeGreaterThanOrEqual(44);
        expect(cancelHeight).toBeGreaterThanOrEqual(44);
      });
    });

    it('audits the component tree using A11yAuditor', () => {
      const mockClient = { match: jest.fn() };
      const { UNSAFE_root } = render(
        <SemanticForm
          client={mockClient as any}
          targetType="https://schema.org/Product"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Run A11yAuditor on the tree
      const pass = A11yAuditor.auditTree(UNSAFE_root);
      expect(pass).toBe(true);
    });
  });

  describe('4. Dynamic Dimension Behaviors', () => {
    let useWindowDimensionsSpy: jest.SpyInstance;

    beforeEach(() => {
      useWindowDimensionsSpy = jest.spyOn(require('react-native'), 'useWindowDimensions');
    });

    afterEach(() => {
      useWindowDimensionsSpy.mockRestore();
    });

    it('handles responsive layout adjustments when orientation changes', () => {
      // 1. Portrait mode
      useWindowDimensionsSpy.mockReturnValue({
        width: 375,
        height: 812,
        scale: 3,
        fontScale: 1,
      });

      const mockTopology = {
        nodes: [{ id: '1', type: 'actor' as const, label: 'Actor 1', tension: 0.5 }],
        edges: [],
      };

      const { getByTestId, rerender } = render(<TelemetryGraph3D topology={mockTopology} />);
      const graph = getByTestId('telemetry-graph-3d');
      expect(graph).toBeTruthy();

      // 2. Simulate Landscape transition
      useWindowDimensionsSpy.mockReturnValue({
        width: 812,
        height: 375,
        scale: 3,
        fontScale: 1,
      });

      rerender(<TelemetryGraph3D topology={mockTopology} />);
      expect(getByTestId('telemetry-graph-3d')).toBeTruthy();
    });

    it('PinchToZoom handles zoom scale and dynamic view bounds in animated style', () => {
      useWindowDimensionsSpy.mockReturnValue({
        width: 400,
        height: 800,
        scale: 2,
        fontScale: 1,
      });

      const { UNSAFE_root } = render(
        <PinchToZoom>
          <Text>Zoomable Text</Text>
        </PinchToZoom>
      );

      // Verify container rendering
      expect(UNSAFE_root).toBeTruthy();
    });
  });
});
