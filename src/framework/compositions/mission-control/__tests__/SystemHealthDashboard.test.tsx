import React from 'react';
import { render } from '@testing-library/react-native';
import { SystemHealthDashboard } from '../SystemHealthDashboard';
import { useAppVitals } from '../../../admin/metrics/useAppVitals';

// Mock the hook
jest.mock('../../../admin/metrics/useAppVitals');

const mockedUseAppVitals = useAppVitals as jest.MockedFunction<typeof useAppVitals>;

describe('SystemHealthDashboard', () => {
  it('renders correctly with healthy vitals', () => {
    mockedUseAppVitals.mockReturnValue({
      jsFps: 60,
      uiFps: 60,
      memory: 150.5,
    });

    const { getByText, getAllByText } = render(<SystemHealthDashboard />);

    expect(getByText('System Health')).toBeTruthy();
    expect(getAllByText('60').length).toBeGreaterThan(0); // JS and UI FPS
    expect(getByText('150.5')).toBeTruthy(); // Memory
  });

  it('renders correctly with warning vitals', () => {
    mockedUseAppVitals.mockReturnValue({
      jsFps: 30,
      uiFps: 40,
      memory: 300,
    });

    const { getByText } = render(<SystemHealthDashboard />);

    expect(getByText('30')).toBeTruthy();
    expect(getByText('40')).toBeTruthy();
    expect(getByText('300.0')).toBeTruthy();
  });

  it('renders correctly with critical vitals', () => {
    mockedUseAppVitals.mockReturnValue({
      jsFps: 10,
      uiFps: 15,
      memory: 600,
    });

    const { getByText } = render(<SystemHealthDashboard />);

    expect(getByText('10')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
    expect(getByText('600.0')).toBeTruthy();
  });
});
