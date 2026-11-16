import React from 'react';
import { render } from '@testing-library/react-native';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge', () => {
  it('renders with success variant correctly', () => {
    const { getByText } = render(<StatusBadge status="applied_local" />);
    expect(getByText('applied local')).toBeTruthy();
  });

  it('renders with danger variant correctly', () => {
    const { getByText } = render(<StatusBadge status="rejected_remote" />);
    expect(getByText('rejected remote')).toBeTruthy();
  });

  it('renders with warning variant correctly', () => {
    const { getByText } = render(<StatusBadge status="accepted_pending" />);
    expect(getByText('accepted pending')).toBeTruthy();
  });
});
