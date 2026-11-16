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
});
