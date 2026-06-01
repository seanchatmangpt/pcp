import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AdminShell } from '../components/AdminShell';
import { Text } from 'react-native';

describe('AdminShell', () => {
  it('renders children, title and subtitle', () => {
    const { getByText } = render(
      <AdminShell title="Admin Dashboard" subtitle="v1.0.0">
        <Text>Inner Content</Text>
      </AdminShell>
    );

    expect(getByText('Admin Dashboard')).toBeTruthy();
    expect(getByText('v1.0.0')).toBeTruthy();
    expect(getByText('Inner Content')).toBeTruthy();
  });

  it('renders back button if onBack is provided', () => {
    const onBackMock = jest.fn();
    const { getByLabelText } = render(
      <AdminShell title="Admin" onBack={onBackMock}>
        <Text>Content</Text>
      </AdminShell>
    );

    const backBtn = getByLabelText('Go back');
    expect(backBtn).toBeTruthy();

    fireEvent.press(backBtn);
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it('renders navigation items and handles navigation', () => {
    const onNavigateMock = jest.fn();
    const items = [
      { id: '1', name: 'Dashboard' },
      { id: '2', name: 'Settings' },
    ];

    const { getByText } = render(
      <AdminShell
        title="Admin"
        navigationItems={items}
        activeNavigationId="1"
        onNavigate={onNavigateMock}>
        <Text>Content</Text>
      </AdminShell>
    );

    expect(getByText('Dashboard')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();

    fireEvent.press(getByText('Settings'));
    expect(onNavigateMock).toHaveBeenCalledWith(items[1]);
  });

  it('renders headerBanner if provided', () => {
    const { getByText } = render(
      <AdminShell title="Admin" headerBanner={<Text>Banner Content</Text>}>
        <Text>Content</Text>
      </AdminShell>
    );

    expect(getByText('Banner Content')).toBeTruthy();
  });

  it('supports unscrollable mode', () => {
    const { getByTestId } = render(
      <AdminShell title="Admin" scrollable={false} testID="shell">
        <Text>Content</Text>
      </AdminShell>
    );

    expect(getByTestId('shell-content')).toBeTruthy();
    // Assuming View vs ScrollView mapping based on testID container
  });
});
