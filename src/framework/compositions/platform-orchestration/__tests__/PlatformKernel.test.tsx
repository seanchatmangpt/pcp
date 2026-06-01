import React from 'react';
import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { PlatformKernel } from '../PlatformKernel';
import { useModuleFederation } from '../../../core/micro-frontend/useModuleFederation';

// Mock the hook
jest.mock('../../../core/micro-frontend/useModuleFederation', () => ({
  useModuleFederation: jest.fn(),
}));

describe('PlatformKernel', () => {
  const mockModules = [
    { name: 'ModuleA', url: 'http://a.js', scope: 'scopeA', module: './Module' },
    { name: 'ModuleB', url: 'http://b.js', scope: 'scopeB', module: './Module' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as any);
    Object.defineProperty(AppState, 'currentState', {
      get: jest.fn(() => 'active'),
      configurable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('renders correctly and triggers pre-loading for modules', () => {
    render(<PlatformKernel modules={mockModules} />);

    expect(useModuleFederation).toHaveBeenCalledTimes(2);
    expect(useModuleFederation).toHaveBeenCalledWith(mockModules[0]);
    expect(useModuleFederation).toHaveBeenCalledWith(mockModules[1]);
  });

  it('listens to AppState changes', () => {
    const onAppStateChange = jest.fn();
    const removeSubscription = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValue({ remove: removeSubscription });

    render(<PlatformKernel onAppStateChange={onAppStateChange} />);

    // Get the callback passed to addEventListener
    const callback = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
    callback('background');

    expect(onAppStateChange).toHaveBeenCalledWith('background');
  });

  it('removes AppState listener on unmount', () => {
    const removeSubscription = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValue({ remove: removeSubscription });

    const { unmount } = render(<PlatformKernel />);
    unmount();

    expect(removeSubscription).toHaveBeenCalled();
  });

  it('handles empty modules list', () => {
    render(<PlatformKernel />);
    expect(useModuleFederation).not.toHaveBeenCalled();
  });
});
