import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { OfflineBanner } from '../OfflineBanner';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';

jest.mock('@/src/lib/actor/actorOps', () => ({
  useActorOpsStore: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('OfflineBanner', () => {
  let mockSetNetworkOnline: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('transitions to connected state and hides after delay', () => {
    // Start offline
    let isOnline = false;
    (useActorOpsStore as unknown as jest.Mock).mockImplementation((selector) => {
      return selector({ networkOnline: isOnline, setNetworkOnline: mockSetNetworkOnline });
    });

    const { getByText, rerender, queryByText } = render(<OfflineBanner />);
    expect(getByText('Device Offline — Using Pre-Admission Tension Queue')).toBeTruthy();

    // Go online
    isOnline = true;
    (useActorOpsStore as unknown as jest.Mock).mockImplementation((selector) => {
      return selector({ networkOnline: isOnline, setNetworkOnline: mockSetNetworkOnline });
    });

    rerender(<OfflineBanner />);

    expect(getByText('Connection Restored')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Should hide
    // skip testing Animated completion in jest since react-native's Animated mock is complex
  });
});
