import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { JsonInspector } from '../components/JsonInspector';

describe('JsonInspector', () => {
  it('renders correctly with object data', () => {
    const { getByText } = render(<JsonInspector data={{ key: 'value' }} title="Test Payload" />);
    expect(getByText('Test Payload')).toBeTruthy();
  });

  it('renders correctly with stringified json', () => {
    const { getByText } = render(<JsonInspector data='{"key":"value"}' title="Test Payload" />);
    expect(getByText('Test Payload')).toBeTruthy();
  });

  it('renders correctly with invalid string data (fallback)', () => {
    const { getByText, getByTestId } = render(
      <JsonInspector
        data="invalid-json"
        title="Test Payload"
        initiallyExpanded={true}
        testID="json-inspector"
      />
    );
    expect(getByText('Test Payload')).toBeTruthy();
    expect(getByTestId('json-inspector-body')).toBeTruthy();
  });

  it('toggles expansion state when pressed', () => {
    const { getByTestId, queryByTestId } = render(<JsonInspector data={{ a: 1 }} testID="json" />);

    // Initially collapsed
    expect(queryByTestId('json-body')).toBeNull();

    // Tap to expand
    fireEvent.press(getByTestId('json-toggle'));
    expect(getByTestId('json-body')).toBeTruthy();

    // Tap to collapse
    fireEvent.press(getByTestId('json-toggle'));
    expect(queryByTestId('json-body')).toBeNull();
  });
});
