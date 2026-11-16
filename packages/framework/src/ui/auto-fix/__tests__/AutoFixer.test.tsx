import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AutoFixer } from '../AutoFixer';
import * as analyzer from '../analyzer';

// Mock analyzer
jest.mock('../analyzer', () => ({
  analyzeError: jest.fn(),
}));

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      clearAll: jest.fn(),
    })),
  };
});

describe('AutoFixer Component', () => {
  const mockOnReset = jest.fn();
  const testError = new Error('Test Error');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with suggestions', () => {
    (analyzer.analyzeError as jest.Mock).mockReturnValue({
      causes: ['Test cause'],
      suggestions: [
        {
          id: 'fix-1',
          title: 'Fix 1',
          description: 'Description 1',
          impact: 'low',
          action: jest.fn(),
        },
      ],
    });

    const { getByText } = render(<AutoFixer error={testError} onReset={mockOnReset} />);

    expect(getByText('Pcp Intelligent Repair')).toBeTruthy();
    expect(getByText('• Test cause')).toBeTruthy();
    expect(getByText('Fix 1')).toBeTruthy();
    expect(getByText('Description 1')).toBeTruthy();
  });

  it('calls action and onReset when a suggestion is pressed', async () => {
    const mockAction = jest.fn();
    (analyzer.analyzeError as jest.Mock).mockReturnValue({
      causes: [],
      suggestions: [
        {
          id: 'fix-1',
          title: 'Fix 1',
          description: 'Description 1',
          impact: 'low',
          action: mockAction,
        },
      ],
    });

    const { getByText } = render(<AutoFixer error={testError} onReset={mockOnReset} />);

    fireEvent.press(getByText('Fix 1'));

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalled();
      expect(mockOnReset).toHaveBeenCalled();
    });
  });

  it('handles action failure gracefully', async () => {
    const mockAction = jest.fn().mockRejectedValue(new Error('Action failed'));
    console.error = jest.fn(); // Suppress error logging in test

    (analyzer.analyzeError as jest.Mock).mockReturnValue({
      causes: [],
      suggestions: [
        {
          id: 'fix-1',
          title: 'Fix 1',
          description: 'Description 1',
          impact: 'low',
          action: mockAction,
        },
      ],
    });

    const { getByText } = render(<AutoFixer error={testError} onReset={mockOnReset} />);

    fireEvent.press(getByText('Fix 1'));

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      // onReset should NOT be called if action fails
      expect(mockOnReset).not.toHaveBeenCalled();
    });
  });
});
