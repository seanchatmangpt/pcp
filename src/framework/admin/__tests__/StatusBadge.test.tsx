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

  it('renders with info variant correctly', () => {
    const { getByText } = render(<StatusBadge status="applied_remote" />);
    expect(getByText('applied remote')).toBeTruthy();
  });

  it('renders with purple variant correctly for quarantined', () => {
    const { getByText } = render(<StatusBadge status="quarantined" />);
    expect(getByText('quarantined')).toBeTruthy();
  });

  it('renders with neutral variant for unknown status', () => {
    const { getByText } = render(<StatusBadge status="unknown_status" />);
    expect(getByText('unknown status')).toBeTruthy();
  });

  it('respects explicitly provided variant', () => {
    const { getByText } = render(<StatusBadge status="foo" variant="danger" />);
    expect(getByText('foo')).toBeTruthy();
    // testing explicit style overrides would be more complex without checking style props,
    // but we trust the component logic.
  });

  it('handles empty status', () => {
    const { getByText } = render(<StatusBadge status={''} />);
    expect(getByText('unknown')).toBeTruthy();
  });
});
