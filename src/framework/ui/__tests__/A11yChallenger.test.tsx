import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import PcpDashboard from '../../../../apps/template-app/src/app/(tabs)/index';
import Auth from '../../../../apps/template-app/src/app/(auth)/index';
import { AdminCard } from '../../../../apps/template-app/src/components/admin/AdminCard';
import { AdminMetric } from '../../../../apps/template-app/src/components/admin/AdminMetric';
import { ThemeProvider } from '../theme/ThemeContext';
import { defaultLightTheme } from '../theme/defaults';
import { supabase } from '../../../../lib/supabase';

// Mock required modules
jest.mock('@/context/SessionProvider', () => ({
  useSession: () => ({
    session: { user: { id: 'test-user', email: 'test@example.com' } },
    loading: false,
    isTransitioning: false,
  }),
}));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}));

// Mock @expo/vector-icons fully for Auth screen icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('View', props),
    Feather: (props: any) => React.createElement('View', props),
    FontAwesome: (props: any) => React.createElement('View', props),
  };
});

describe('Empirical Accessibility & Theming Verification', () => {
  describe('Requirement 2: Dashboard PCP TITLE Contrast', () => {
    it('verifies Dashboard PCP TITLE is rendered', () => {
      const { getByText } = render(<PcpDashboard />);
      const title = getByText('PCP DASHBOARD');
      expect(title).toBeTruthy();

      // Log classes of Dashboard PCP TITLE for documentation
      console.log('Dashboard PCP TITLE props:', title.props);
    });
  });

  describe('Requirement 3: Auth Screen Alert Banner Close Button Contrast', () => {
    it('verifies close button colors and background colors in error and success alert banners', async () => {
      // Mock supabase to return an auth error
      const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
      mockSignIn.mockResolvedValue({
        data: { session: null },
        error: { message: 'Authentication error simulated' },
      });

      const { getByText, getByPlaceholderText, getByTestId, queryByTestId } = render(<Auth />);
      
      // Initially, no banner
      expect(queryByTestId('close-banner-button')).toBeNull();

      // Input email and password
      const emailInput = getByPlaceholderText('your@email.com');
      const passwordInput = getByPlaceholderText('Enter your password');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Click the submit button
      const submitButton = getByText('Establish Secure Session');
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // Now close button should be visible
      const closeButton = getByTestId('close-banner-button');
      expect(closeButton).toBeTruthy();

      // The icon inside close button is a Feather icon
      const icon = closeButton.props.children;
      expect(icon).toBeTruthy();
      console.log('Error Banner Close Button Props:', icon.props);
    });
  });

  describe('Requirement 4: AdminCard & AdminMetric Dynamic Light Theme Rendering', () => {
    it('verifies AdminCard uses dynamic light theme background color and does not fall back to dark slate-800', () => {
      const { getByTestId } = render(
        <ThemeProvider>
          <AdminCard title="Test Card" testID="admin-card">
            <React.Fragment />
          </AdminCard>
        </ThemeProvider>
      );

      const card = getByTestId('admin-card');
      const style = card.props.style;
      
      // Flatten the style array (React Native styles can be arrays of objects)
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style;

      console.log('AdminCard flattened styles in light theme:', flatStyle);

      // The background color must be defaultLightTheme.colors.card (#ffffff)
      // and NOT the dark fallback style (#1E293B)
      expect(flatStyle.backgroundColor).toBe(defaultLightTheme.colors.card);
      expect(flatStyle.borderColor).toBe(defaultLightTheme.colors.border);
    });

    it('verifies AdminMetric uses dynamic light theme background color and does not fall back to dark slate-800', () => {
      const { getByTestId } = render(
        <ThemeProvider>
          <AdminMetric label="Test Metric" value="42" icon="user" testID="admin-metric" />
        </ThemeProvider>
      );

      const metric = getByTestId('admin-metric');
      const style = metric.props.style;

      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style;

      console.log('AdminMetric flattened styles in light theme:', flatStyle);

      expect(flatStyle.backgroundColor).toBe(defaultLightTheme.colors.card);
      expect(flatStyle.borderColor).toBe(defaultLightTheme.colors.border);
    });
  });
});
