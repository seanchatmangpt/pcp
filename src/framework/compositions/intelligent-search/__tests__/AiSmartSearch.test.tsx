import React from 'react';
import { View, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AiSmartSearch } from '../AiSmartSearch';
import { useIntelligentSearch } from '../useIntelligentSearch';

jest.mock('../useIntelligentSearch');

describe('AiSmartSearch', () => {
  const mockOnResults = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default UI with results', () => {
    (useIntelligentSearch as jest.Mock).mockReturnValue({
      results: [
        {
          quad: {
            subject: { value: 's' },
            predicate: { value: 'p' },
            object: { value: 'o' },
          },
          score: 0.95,
        },
      ],
      isLoading: false,
      error: null,
      expandedQuery: 'expanded',
    });

    const { getByText } = render(<AiSmartSearch query="test" />);

    expect(getByText(/Searching for:/)).toBeTruthy();
    expect(getByText('expanded')).toBeTruthy();
    expect(getByText(/s - p - o/)).toBeTruthy();
    expect(getByText(/\(Score: 0.95\)/)).toBeTruthy();
  });

  it('renders thinking state', () => {
    (useIntelligentSearch as jest.Mock).mockReturnValue({
      results: [],
      isLoading: true,
      error: null,
    });

    const { getByText } = render(<AiSmartSearch query="test" />);
    expect(getByText('Thinking...')).toBeTruthy();
  });

  it('renders error state', () => {
    (useIntelligentSearch as jest.Mock).mockReturnValue({
      results: [],
      isLoading: false,
      error: new Error('Something failed'),
    });

    const { getByText } = render(<AiSmartSearch query="test" />);
    expect(getByText('Something failed')).toBeTruthy();
  });

  it('calls onResults when results change', () => {
    const results = [
      {
        quad: { subject: { value: 's' }, predicate: { value: 'p' }, object: { value: 'o' } },
        score: 1,
      },
    ];
    (useIntelligentSearch as jest.Mock).mockReturnValue({
      results,
      isLoading: false,
      error: null,
    });

    render(<AiSmartSearch query="test" onResults={mockOnResults} />);

    expect(mockOnResults).toHaveBeenCalledWith(results);
  });

  it('calls onError when error occurs', () => {
    const error = new Error('Test Error');
    (useIntelligentSearch as jest.Mock).mockReturnValue({
      results: [],
      isLoading: false,
      error,
    });

    render(<AiSmartSearch query="test" onError={mockOnError} />);

    expect(mockOnError).toHaveBeenCalledWith(error);
  });

  it('renders custom children function', () => {
    (useIntelligentSearch as jest.Mock).mockReturnValue({
      results: [],
      isLoading: false,
      error: null,
      expandedQuery: 'custom expanded',
    });

    const { getByText } = render(
      <AiSmartSearch query="test">
        {(state) => (
          <View>
            <Text>Custom UI: {state.expandedQuery}</Text>
          </View>
        )}
      </AiSmartSearch>
    );

    expect(getByText('Custom UI: custom expanded')).toBeTruthy();
  });
});
