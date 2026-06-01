import React from 'react';
import { View, Text, Button } from 'react-native';
import { render, act, screen, fireEvent } from '@testing-library/react-native';
import { TemporalProvider, useTimeTravel } from '../TemporalProvider';
import { MembraneChain } from '../MembraneChain';
import { TemporalNavigator } from '../TemporalNavigator';

describe('Temporal Routing', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('MembraneChain stores and retrieves receipts', () => {
    const chain = new MembraneChain();
    chain.append({ id: '1', timestamp: 100, path: '/a', state: {} });
    // Out of order append to test sorting
    chain.append({ id: '3', timestamp: 300, path: '/c', state: {} });
    chain.append({ id: '2', timestamp: 200, path: '/b', state: {} });

    expect(chain.getReceipts().length).toBe(3);
    expect(chain.getReceipts()[1].id).toBe('2');
    expect(chain.getReceiptAt(150)?.id).toBe('1');
    expect(chain.getReceiptAt(250)?.id).toBe('2');
    expect(chain.getReceiptAt(300)?.id).toBe('3');
    expect(chain.getReceiptAt(50)).toBeNull();

    chain.clear();
    expect(chain.getReceipts().length).toBe(0);
  });

  it('TemporalNavigator navigates and notifies', () => {
    const chain = new MembraneChain();
    const nav = new TemporalNavigator(chain);

    expect(nav.getCurrentRoute()).toBeNull();

    const cb = jest.fn();
    const unsub = nav.subscribe(cb);

    jest.setSystemTime(2000);
    nav.navigate('/test', { foo: 'bar' });
    expect(cb).toHaveBeenCalledTimes(1);

    const route = nav.getCurrentRoute();
    expect(route?.path).toBe('/test');
    expect(route?.state.foo).toBe('bar');
    expect(route?.timestamp).toBe(2000);

    unsub();

    jest.setSystemTime(3000);
    nav.navigate('/test2', {});
    expect(cb).toHaveBeenCalledTimes(1); // not called again

    nav.travelTo(2000);
    expect(nav.getCurrentRoute()?.path).toBe('/test');
  });

  it('TemporalNavigator travelTo throws if no state found', () => {
    const chain = new MembraneChain();
    const nav = new TemporalNavigator(chain);

    expect(() => nav.travelTo(500)).toThrow('No state found at timestamp 500');
  });

  it('TemporalNavigator notify with null route', () => {
    const chain = new MembraneChain();
    const nav = new TemporalNavigator(chain);

    const cb = jest.fn();
    nav.subscribe(cb);

    chain.clear();
    (nav as any).notify();
    expect(cb).not.toHaveBeenCalled();
  });

  const TestComponent = () => {
    const { currentRoute, navigate, travelTo } = useTimeTravel();
    return (
      <View>
        <Text testID="path">{currentRoute?.path || 'none'}</Text>
        <Button testID="nav-btn" title="Nav" onPress={() => navigate('/new', { a: 1 })} />
        <Button
          testID="nav-no-state-btn"
          title="NavNoState"
          onPress={() => navigate('/new-no-state')}
        />
        <Button testID="travel-btn" title="Travel" onPress={() => travelTo(2000)} />
      </View>
    );
  };

  it('TemporalProvider provides context to useTimeTravel', () => {
    const chain = new MembraneChain();

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      'useTimeTravel must be used within a TemporalProvider'
    );
    consoleError.mockRestore();

    render(
      <TemporalProvider chain={chain}>
        <TestComponent />
      </TemporalProvider>
    );

    expect(screen.getByTestId('path').props.children).toBe('none');
  });

  it('TemporalProvider updates on navigate and travel', () => {
    const chain = new MembraneChain();
    render(
      <TemporalProvider chain={chain}>
        <TestComponent />
      </TemporalProvider>
    );

    expect(screen.getByTestId('path').props.children).toBe('none');

    jest.setSystemTime(2000);
    act(() => {
      fireEvent.press(screen.getByTestId('nav-btn'));
    });

    expect(screen.getByTestId('path').props.children).toBe('/new');

    jest.setSystemTime(3000);
    act(() => {
      fireEvent.press(screen.getByTestId('nav-no-state-btn'));
    });

    expect(screen.getByTestId('path').props.children).toBe('/new-no-state');

    act(() => {
      fireEvent.press(screen.getByTestId('travel-btn'));
    });

    expect(screen.getByTestId('path').props.children).toBe('/new');
  });

  it('TemporalProvider defaults to new MembraneChain if none provided', () => {
    const { unmount } = render(
      <TemporalProvider>
        <TestComponent />
      </TemporalProvider>
    );

    jest.setSystemTime(5000);
    act(() => {
      fireEvent.press(screen.getByTestId('nav-btn'));
    });

    expect(screen.getByTestId('path').props.children).toBe('/new');
    unmount();
  });
});
