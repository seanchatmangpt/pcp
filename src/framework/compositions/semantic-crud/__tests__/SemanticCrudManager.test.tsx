import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SemanticCrudManager } from '../SemanticCrudManager';
import { useVkg } from '../../../vkg/react';
import { useOfflineSearch } from '../../../data/offline-search';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('../../../vkg/react', () => ({
  useVkg: jest.fn(),
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

describe('SemanticCrudManager', () => {
  const mockTriggerHook = jest.fn();
  const mockTargetType = 'https://schema.org/Person';

  beforeEach(() => {
    jest.clearAllMocks();
    (useVkg as jest.Mock).mockReturnValue({
      triggerHook: mockTriggerHook,
    });
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [],
      loading: false,
      search: jest.fn(),
      query: '',
    });
  });

  it('renders list view by default', () => {
    const { getByTestId } = render(<SemanticCrudManager targetType={mockTargetType} />);
    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('navigates to create view', () => {
    const { getByTestId, getByText } = render(<SemanticCrudManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('create-button'));
    expect(getByTestId('mock-semantic-form')).toBeTruthy();
    expect(getByText('Create')).toBeTruthy();
  });

  it('handles create submission', async () => {
    const { getByTestId } = render(<SemanticCrudManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('create-button'));

    await act(async () => {
      fireEvent.press(getByTestId('submit-form-button'));
    });

    expect(mockTriggerHook).toHaveBeenCalledWith(
      expect.stringContaining('https://pcp.app/entity/'),
      'https://schema.org/name',
      'Test Entity'
    );
    expect(mockTriggerHook).toHaveBeenCalledWith(
      expect.stringContaining('https://pcp.app/entity/'),
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      mockTargetType
    );

    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('navigates to details and back to list', () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: 'test',
    });

    const { getByTestId, getByText } = render(<SemanticCrudManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));

    expect(getByTestId('details-view')).toBeTruthy();
    expect(getByText('https://pcp.app/entity/123')).toBeTruthy();

    fireEvent.press(getByTestId('back-button'));
    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('handles edit submission', async () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: 'test',
    });

    const { getByTestId, getByText } = render(<SemanticCrudManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));
    fireEvent.press(getByTestId('edit-button'));

    expect(getByText('Save Changes')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('submit-form-button'));
    });

    expect(mockTriggerHook).toHaveBeenCalledWith(
      'https://pcp.app/entity/123',
      'https://schema.org/name',
      'Test Entity'
    );

    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('handles delete', async () => {
    const mockOnDelete = jest.fn();
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [{ subject: 'https://pcp.app/entity/123', predicate: 'p', objectValue: 'v' }],
      loading: false,
      search: jest.fn(),
      query: 'test',
    });

    const { getByTestId } = render(
      <SemanticCrudManager targetType={mockTargetType} onEntityDelete={mockOnDelete} />
    );

    fireEvent.press(getByTestId('item-https://pcp.app/entity/123'));

    await act(async () => {
      fireEvent.press(getByTestId('delete-button'));
    });

    expect(mockOnDelete).toHaveBeenCalledWith('https://pcp.app/entity/123');
    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('handles cancel in form', () => {
    const { getByTestId } = render(<SemanticCrudManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('create-button'));
    fireEvent.press(getByTestId('cancel-form-button'));

    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('handles error in submission', async () => {
    mockTriggerHook.mockRejectedValue(new Error('fail'));

    const { getByTestId } = render(<SemanticCrudManager targetType={mockTargetType} />);

    fireEvent.press(getByTestId('create-button'));

    await act(async () => {
      fireEvent.press(getByTestId('submit-form-button'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Persistence Error', expect.any(String));
  });
});
