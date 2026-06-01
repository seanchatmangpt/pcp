import React from 'react';
import { render } from '@testing-library/react-native';
import { QuadDeltaPreview } from '../components/QuadDeltaPreview';

describe('QuadDeltaPreview', () => {
  it('renders invalid payload when delta is null', () => {
    const { getByText } = render(<QuadDeltaPreview delta={null} />);
    expect(getByText('Invalid Delta payload')).toBeTruthy();
  });

  it('renders invalid payload when delta is not an object', () => {
    const { getByText } = render(<QuadDeltaPreview delta="invalid-json" />);
    expect(getByText('Invalid Delta payload')).toBeTruthy();
  });

  it('renders empty state when no additions or removals', () => {
    const { getByText } = render(<QuadDeltaPreview delta={{ add: [], remove: [] }} />);
    expect(getByText('No changes (empty delta)')).toBeTruthy();
  });

  it('renders parsed additions and removals correctly', () => {
    const delta = {
      add: [{ subject: 's1', predicate: 'p1', object: 'o1' }],
      remove: [{ subject: 's2', predicate: 'p2', object: 'o2' }],
    };
    const { getByText } = render(<QuadDeltaPreview delta={delta} />);

    expect(getByText('+')).toBeTruthy();
    expect(getByText('-')).toBeTruthy();
    expect(getByText('s1')).toBeTruthy();
    expect(getByText('s2')).toBeTruthy();
  });

  it('parses stringified delta correctly', () => {
    const deltaStr = JSON.stringify({
      add: [
        {
          subject: 'https://schema.org/Person',
          predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          object: 'o1',
        },
      ],
    });
    const { getByText } = render(<QuadDeltaPreview delta={deltaStr} />);

    expect(getByText('+')).toBeTruthy();
    expect(getByText('schema:Person')).toBeTruthy();
    expect(getByText('rdf:type')).toBeTruthy();
  });

  it('handles quad with falsy nodes', () => {
    const delta = { add: [{ subject: null, predicate: undefined, object: '' }] };
    const { getAllByText } = render(<QuadDeltaPreview delta={delta} />);

    expect(getAllByText('null').length).toBeGreaterThanOrEqual(2);
  });
});
