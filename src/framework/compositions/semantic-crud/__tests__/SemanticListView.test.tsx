import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SemanticListView } from '../SemanticListView';
import { useOfflineSearch } from '../../../data/offline-search';
import { A11yAuditor } from '../../../validation/A11yAuditor';

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

  it('passes accessibility audit', () => {
    const { UNSAFE_root } = render(
      <SemanticListView
        targetType="https://schema.org/Person"
        onSelect={mockOnSelect}
        onCreate={mockOnCreate}
      />
    );
    expect(() => A11yAuditor.auditTree(UNSAFE_root)).not.toThrow();
  });
});
