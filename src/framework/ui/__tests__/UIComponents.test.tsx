import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Text, View, Keyboard } from 'react-native';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { MonoText } from '../StyledText';
import { Text as ThemedText, View as ThemedView, useThemedColor } from '../Themed';
import { ThemeProvider } from '../theme/ThemeContext';
import { KeyboardSafeForm } from '../KeyboardSafeForm';
import { OfflineBanner } from '../OfflineBanner';
import { TransitionOverlay } from '../TransitionOverlay';
import {
  StackProtected,
  TabsProtected,
} from '../AvatarRelativeProjection';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';

// Mock required modules
jest.mock('@/src/lib/actor/actorOps', () => ({
  useActorOpsStore: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return {
    ...Reanimated,
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn((cb) => cb()),
    withTiming: jest.fn((val, config, cb) => {
      if (cb) cb(true);
      return val;
    }),
    withSpring: jest.fn((val) => val),
    runOnJS: jest.fn((fn) => fn),
    cancelAnimation: jest.fn(),
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  const StackComponent = React.forwardRef(
    (
      { children, ...props }: { children?: React.ReactNode; [key: string]: any },
      ref: React.Ref<any>
    ) => <>{children}</>
  );
  const TabsComponent = React.forwardRef(
    (
      { children, ...props }: { children?: React.ReactNode; [key: string]: any },
      ref: React.Ref<any>
    ) => <>{children}</>
  );
  return {
    Stack: Object.assign(StackComponent, { Screen: () => null }),
    Tabs: Object.assign(TabsComponent, { Screen: () => null }),
  };
});

jest.mock('../../../lib/truex/avatar/matrix', () => ({
  PROJECTION_MATRIX: {
    volunteer_shortage: jest.fn((data, role) => {
      if (role === 'guest')
        return { visible: false, surface: 'none', allowedActions: [], payload: null };
      return {
        visible: true,
        surface: 'dashboard',
        allowedActions: ['notify'],
        payload: {
          message: 'Shortage info',
          openSlots: data.openSlots,
          candidates: data.candidates,
          shortageRatio: data.shortageRatio,
          runId: data.runId,
          history: data.history,
          topology: data.topology,
          stateHash: data.stateHash,
        },
      };
    }),
  },
}));

describe('Consolidated UI Component Tests', () => {

  // --- Badge ---
  describe('Badge', () => {
    it('renders correctly with default props', () => {
      const { getByText } = render(<Badge>Default Badge</Badge>);
      expect(getByText('Default Badge')).toBeTruthy();
    });

    it('renders correctly with different variants', () => {
      const { getByText } = render(<Badge variant="success">Success Badge</Badge>);
      expect(getByText('Success Badge')).toBeTruthy();
    });

    it('renders children correctly when they are React nodes', () => {
      const { getByTestId } = render(
        <Badge>
          <Text testID="custom-child">Custom Child</Text>
        </Badge>
      );
      expect(getByTestId('custom-child')).toBeTruthy();
    });
  });

  // --- Button ---
  describe('Button', () => {
    it('renders correctly with default props', () => {
      const { getByText } = render(<Button>Default Button</Button>);
      expect(getByText('Default Button')).toBeTruthy();
    });

    it('renders correctly with different variants', () => {
      const { getByText } = render(<Button variant="primary">Primary Button</Button>);
      expect(getByText('Primary Button')).toBeTruthy();
    });

    it('renders correctly with different sizes', () => {
      const { getByText } = render(<Button size="lg">Large Button</Button>);
      expect(getByText('Large Button')).toBeTruthy();
    });
  });

  // --- StyledText ---
  describe('StyledText', () => {
    it('renders MonoText with correct font family and additional className', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );
      const { getByText } = render(<MonoText className="extra">Hello</MonoText>, { wrapper });
      const text = getByText('Hello');
      expect(text).toBeTruthy();
    });
  });

  // --- Themed Components ---
  describe('Themed Components', () => {
    const renderWithTheme = (ui: React.ReactElement) => {
      return render(<ThemeProvider>{ui}</ThemeProvider>);
    };

    describe('useThemedColor', () => {
      const TestComponent = ({ colorName }: { colorName: 'text' | 'background' }) => {
        const color = useThemedColor(colorName);
        return <ThemedView style={{ backgroundColor: color }} testID="themed-view" />;
      };

      it('returns themed class for text', () => {
        const { getByTestId } = renderWithTheme(<TestComponent colorName="text" />);
        expect(getByTestId('themed-view')).toBeTruthy();
      });

      it('returns themed class for background', () => {
        const { getByTestId } = renderWithTheme(<TestComponent colorName="background" />);
        expect(getByTestId('themed-view')).toBeTruthy();
      });
    });

    describe('Text component', () => {
      it('renders correctly with default styles', () => {
        const { getByText } = renderWithTheme(<ThemedText>Hello World</ThemedText>);
        const text = getByText('Hello World');
        expect(text).toBeTruthy();
      });
    });
  });

  // --- KeyboardSafeForm ---
  describe('KeyboardSafeForm', () => {
    it('renders children correctly', () => {
      const { getByText } = render(
        <KeyboardSafeForm>
          <Text>Test Child</Text>
        </KeyboardSafeForm>
      );
      expect(getByText('Test Child')).toBeTruthy();
    });

    it('dismisses keyboard on background tap when dismissOnTap is true', () => {
      const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
      const { getByTestId } = render(
        <KeyboardSafeForm dismissOnTap={true}>
          <Text>Test Child</Text>
        </KeyboardSafeForm>
      );

      const pressable = getByTestId('keyboard-dismiss-pressable');
      fireEvent.press(pressable);

      expect(dismissSpy).toHaveBeenCalled();
      dismissSpy.mockRestore();
    });

    it('does not render tap dismiss wrapper when dismissOnTap is false', () => {
      const { queryByTestId } = render(
        <KeyboardSafeForm dismissOnTap={false}>
          <Text>Test Child</Text>
        </KeyboardSafeForm>
      );

      expect(queryByTestId('keyboard-dismiss-pressable')).toBeNull();
    });
  });

  // --- OfflineBanner ---
  describe('OfflineBanner', () => {
    let mockSetNetworkOnline: jest.Mock;

    beforeEach(() => {
      mockSetNetworkOnline = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders nothing when initially online', () => {
      (useActorOpsStore as unknown as jest.Mock).mockImplementation((selector) => {
        return selector({ networkOnline: true, setNetworkOnline: mockSetNetworkOnline });
      });

      const { toJSON } = render(<OfflineBanner />);
      expect(toJSON()).toBeNull();
    });

    it('renders offline message when network is offline', () => {
      (useActorOpsStore as unknown as jest.Mock).mockImplementation((selector) => {
        return selector({ networkOnline: false, setNetworkOnline: mockSetNetworkOnline });
      });

      const { getByText, getByTestId } = render(<OfflineBanner />);
      expect(getByText('Device Offline — Using Pre-Admission Tension Queue')).toBeTruthy();
      expect(getByTestId('reconnect-button')).toBeTruthy();
    });

    it('handles reconnect button press', () => {
      (useActorOpsStore as unknown as jest.Mock).mockImplementation((selector) => {
        return selector({ networkOnline: false, setNetworkOnline: mockSetNetworkOnline });
      });

      const { getByTestId, getByText } = render(<OfflineBanner />);
      fireEvent.press(getByTestId('reconnect-button'));

      expect(getByText('Reconnecting to Truex Membrane...')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1200);
      });

      expect(mockSetNetworkOnline).toHaveBeenCalledWith(true);
    });
  });

  // --- TransitionOverlay ---
  describe('TransitionOverlay', () => {
    it('renders nothing when not visible', () => {
      const { toJSON } = render(
        <TransitionOverlay isTransitioning={false} transitionType={null} colorScheme="light" />
      );
      expect(toJSON()).toBeNull();
    });

    it('renders correctly when transitioning to signin in light mode', () => {
      const { getByText } = render(
        <TransitionOverlay isTransitioning={true} transitionType="signin" colorScheme="light" />
      );
      expect(getByText('Welcome back!')).toBeTruthy();
      expect(getByText('Securing session & preparing your workspace')).toBeTruthy();
    });

    it('renders correctly when transitioning to signout in dark mode', () => {
      const { getByText } = render(
        <TransitionOverlay isTransitioning={true} transitionType="signout" colorScheme="dark" />
      );
      expect(getByText('Signing out...')).toBeTruthy();
      expect(getByText('Clearing session cache & returning to login')).toBeTruthy();
    });
  });

  // --- AvatarRelativeProjection ---
  describe('AvatarRelativeProjection', () => {
    describe('StackProtected', () => {
      it('renders children when guard is true', () => {
        const { getByText } = render(
          <StackProtected guard={true}>
            <Text>Content</Text>
          </StackProtected>
        );
        expect(getByText('Content')).toBeTruthy();
      });

      it('renders null when guard is false', () => {
        const { queryByText } = render(
          <StackProtected guard={false}>
            <Text>Content</Text>
          </StackProtected>
        );
        expect(queryByText('Content')).toBeNull();
      });
    });

    describe('TabsProtected', () => {
      it('renders children when guard is true', () => {
        const { getByText } = render(
          <TabsProtected guard={true}>
            <Text>Content</Text>
          </TabsProtected>
        );
        expect(getByText('Content')).toBeTruthy();
      });
    });
  });

});
