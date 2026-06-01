import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { FusionDataManager } from '../FusionDataManager';
import { useVkg } from '../../../vkg/react';
import { useNeuroSymbolicQuery } from '../../../data/neuro-symbolic/useNeuroSymbolicQuery';
import { usePredictivePrefetch } from '../../../data/predictive/usePredictivePrefetch';
import { useOfflineSearch } from '../../../data/offline-search';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('../../../vkg/react', () => ({
  useVkg: jest.fn(),
}));

jest.mock('../../../data/neuro-symbolic/useNeuroSymbolicQuery', () => ({
  useNeuroSymbolicQuery: jest.fn(),
}));

jest.mock('../../../data/predictive/usePredictivePrefetch', () => ({
  usePredictivePrefetch: jest.fn(),
}));

jest.mock('../../../data/offline-search', () => ({
  useOfflineSearch: jest.fn(),
}));

jest.mock('../../../data/forms/SemanticForm', () => {
  const { View, Button, Text } = require('react-native');
  return {
    SemanticForm: ({ onSubmit, onCancel, submitLabel }: any) => (
      <View testID="mock-semantic-form">
        <Text>{submitLabel}</Text>
        <Button
          testID="submit-form-button"
          title="Submit"
          onPress={() => onSubmit({ 'https://schema.org/name': 'Test Entity' })}
        />
        <Button testID="cancel-form-button" title="Cancel" onPress={onCancel} />
      </View>
    ),
  };
});

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('FusionDataManager', () => {
  const mockTriggerHook = jest.fn();
  const mockRefetch = jest.fn();
  const mockTargetType = 'https://schema.org/Person';

  beforeEach(() => {
    jest.clearAllMocks();
    (useVkg as jest.Mock).mockReturnValue({
      triggerHook: mockTriggerHook,
    });
    (useNeuroSymbolicQuery as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [],
      loading: false,
      search: jest.fn(),
      query: '',
    });
  });

  it('renders list view and calls predictive prefetch', () => {
    const { getByTestId } = render(<FusionDataManager targetType={mockTargetType} />);
    expect(getByTestId('search-input')).toBeTruthy();
    expect(usePredictivePrefetch).toHaveBeenCalledWith(mockTargetType, { depth: 2 });
    expect(useNeuroSymbolicQuery).toHaveBeenCalled();
  });

  it('renders AI insight when uiHint is provided', () => {
    const { getByText } = render(
      <FusionDataManager targetType={mockTargetType} uiHint="You should add more contacts." />
    );
    expect(getByText('AI Insight: You should add more contacts.')).toBeTruthy();
  });

  it('navigates to create view and handles submission', async () => {
    const { getByTestId, getByText } = render(<FusionDataManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('create-button'));
    expect(getByTestId('mock-semantic-form')).toBeTruthy();
    expect(getByText('Create')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('submit-form-button'));
    });

    expect(mockTriggerHook).toHaveBeenCalledWith(
      expect.stringContaining('https://pcp.app/entity/'),
      'https://schema.org/name',
      'Test Entity'
    );
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('navigates to details view', () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: '',
    });

    const { getByTestId, getByText } = render(<FusionDataManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));

    expect(getByText('Fusion Entity')).toBeTruthy();
    expect(getByText('https://pcp.app/entity/123')).toBeTruthy();
  });

  it('handles edit mode', async () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: '',
    });

    const { getByTestId, getByText } = render(<FusionDataManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));
    fireEvent.press(getByText('Edit'));

    expect(getByText('Save')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('submit-form-button'));
    });

    expect(mockTriggerHook).toHaveBeenCalledWith(
      'https://pcp.app/entity/123',
      'https://schema.org/name',
      'Test Entity'
    );
  });

  it('handles delete', async () => {
    const mockOnDelete = jest.fn();
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: '',
    });

    const { getByTestId, getByText } = render(
      <FusionDataManager targetType={mockTargetType} onEntityDelete={mockOnDelete} />
    );

    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));

    await act(async () => {
      fireEvent.press(getByText('Delete'));
    });

    expect(mockOnDelete).toHaveBeenCalledWith('https://pcp.app/entity/123');
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('displays error banner when query fails', () => {
    (useNeuroSymbolicQuery as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: new Error('Query failed'),
      refetch: mockRefetch,
    });

    const { getByText } = render(<FusionDataManager targetType={mockTargetType} />);

    expect(getByText('Query failed')).toBeTruthy();
  });

  it('handles submission error', async () => {
    mockTriggerHook.mockRejectedValue(new Error('Persistence failed'));

    const { getByTestId } = render(<FusionDataManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('create-button'));

    await act(async () => {
      fireEvent.press(getByTestId('submit-form-button'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Fusion Error', expect.any(String));
  });

  it('handles cancel in form and details', () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: '',
    });

    const { getByTestId, getByText } = render(<FusionDataManager targetType={mockTargetType} />);

    // Test form cancel
    fireEvent.press(getByTestId('create-button'));
    fireEvent.press(getByTestId('cancel-form-button'));
    expect(getByTestId('search-input')).toBeTruthy();

    // Test details back
    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));
    fireEvent.press(getByText('Back to Discovery'));
    expect(getByTestId('search-input')).toBeTruthy();
  });
});
