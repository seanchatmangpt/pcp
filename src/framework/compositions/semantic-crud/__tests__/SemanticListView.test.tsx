import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SemanticListView } from '../SemanticListView';
import { useOfflineSearch } from '../../../data/offline-search';

// Mock useOfflineSearch
jest.mock('../../../data/offline-search', () => ({
  useOfflineSearch: jest.fn(),
}));

describe('SemanticListView', () => {
  const mockOnSelect = jest.fn();
  const mockOnCreate = jest.fn();
  const mockSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [],
      loading: false,
      search: mockSearch,
      query: '',
    });
  });

  it('renders correctly with empty results', () => {
    const { getByTestId, getByText } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );

    expect(getByTestId('search-input')).toBeTruthy();
    expect(getByTestId('create-button')).toBeTruthy();
    expect(getByText('Search to find Persons.')).toBeTruthy();
  });

  it('calls search when text changes', () => {
    const { getByTestId } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );

    const input = getByTestId('search-input');
    fireEvent.changeText(input, 'John');

    expect(mockSearch).toHaveBeenCalledWith('John');
  });

  it('renders results and handles selection', () => {
    const mockResults = [
      {
        subject: 'https://pcp.app/person/1',
        predicate: 'https://schema.org/name',
        objectValue: 'John Doe',
      },
    ];

    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: mockResults,
      loading: false,
      search: mockSearch,
      query: 'John',
    });

    const { getByText, getByTestId } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );

    expect(getByText('1')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();

    fireEvent.press(getByTestId('item-https://pcp.app/person/1'));
    expect(mockOnSelect).toHaveBeenCalledWith('https://pcp.app/person/1');
  });

  it('calls onCreate when create button is pressed', () => {
    const { getByTestId } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );

    fireEvent.press(getByTestId('create-button'));
    expect(mockOnCreate).toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [],
      loading: true,
      search: mockSearch,
      query: 'John',
    });

    const { getByTestId } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('shows no results message when query is active and no results', () => {
    (useOfflineSearch as jest.Mock).mockReturnValue({
      results: [],
      loading: false,
      search: mockSearch,
      query: 'NotFound',
    });

    const { getByText } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );

    expect(getByText('No matching entities found.')).toBeTruthy();
  });
});
