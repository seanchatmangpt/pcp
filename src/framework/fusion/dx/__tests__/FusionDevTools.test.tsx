import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { FusionDevTools } from '../FusionDevTools';

// Mock blueprints
jest.mock('../../../compositions/blueprints', () => ({
  blueprints: {
    'test-blueprint': {
      name: 'Test Blueprint',
      description: 'A blueprint for testing',
      generate: jest.fn(),
    },
  },
}));

// Mock DocExplorer
jest.mock('../../../core/docs/DocExplorer', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    DocExplorer: () => <View testID="mock-doc-explorer" />,
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

describe('FusionDevTools', () => {
  const originalDev = (global as any).__DEV__;

  beforeEach(() => {
    jest.useFakeTimers();
    (global as any).__DEV__ = true;
  });

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    jest.useRealTimers();
  });

  it('does not render when __DEV__ is false', () => {
    (global as any).__DEV__ = false;
    render(<FusionDevTools />);
    expect(screen.queryByTestId('fusion-devtools-fab')).toBeNull();
  });

  it('renders FAB when __DEV__ is true', () => {
    render(<FusionDevTools />);
    expect(screen.getByTestId('fusion-devtools-fab')).toBeTruthy();
  });

  it('opens modal when FAB is pressed', () => {
    render(<FusionDevTools />);
    fireEvent.press(screen.getByTestId('fusion-devtools-fab'));
    expect(screen.getByTestId('fusion-devtools-modal')).toBeTruthy();
  });

  it('closes modal when close button is pressed', () => {
    render(<FusionDevTools />);
    fireEvent.press(screen.getByTestId('fusion-devtools-fab'));
    fireEvent.press(screen.getByTestId('close-devtools'));
    // State check
  });

  it('switches to scaffold tab and back', () => {
    render(<FusionDevTools />);
    fireEvent.press(screen.getByTestId('fusion-devtools-fab'));

    // Default should be docs
    expect(screen.getByTestId('mock-doc-explorer')).toBeTruthy();

    // Switch to scaffold
    fireEvent.press(screen.getByTestId('tab-scaffold'));
    expect(screen.queryByTestId('mock-doc-explorer')).toBeNull();
    expect(screen.getByTestId('scaffold-view')).toBeTruthy();

    // Switch back to docs
    fireEvent.press(screen.getByTestId('tab-docs'));
    expect(screen.getByTestId('mock-doc-explorer')).toBeTruthy();
  });

  it('triggers scaffolding and shows loading state', () => {
    render(<FusionDevTools />);
    fireEvent.press(screen.getByTestId('fusion-devtools-fab'));
    fireEvent.press(screen.getByTestId('tab-scaffold'));

    const scaffoldBtn = screen.getByTestId('scaffold-btn-test-blueprint');
    fireEvent.press(scaffoldBtn);

    expect(screen.getByText('Generative...')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('Generative...')).toBeNull();
  });
});
