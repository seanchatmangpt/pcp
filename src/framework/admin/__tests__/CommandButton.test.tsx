import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CommandButton } from '../components/CommandButton';

describe('CommandButton', () => {
  it('renders the title correctly', () => {
    const { getByText } = render(<CommandButton title="Click Me" onPress={() => {}} />);
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('fires onPress when clicked', async () => {
    const onPressMock = jest.fn();
    const { getByText } = render(<CommandButton title="Action" onPress={onPressMock} />);

    fireEvent.press(getByText('Action'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <CommandButton title="Action" onPress={onPressMock} disabled={true} />
    );

    fireEvent.press(getByText('Action'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('shows loading spinner and prevents multi-click while loading', async () => {
    const onPressMock = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50)));
    const { getByText, getByTestId } = render(
      <CommandButton title="Action" onPress={onPressMock} testID="btn" />
    );

    const btn = getByText('Action');
    fireEvent.press(btn);

    // Spinner should appear
    expect(getByTestId('btn-spinner')).toBeTruthy();

    // Second click should be ignored
    fireEvent.press(getByTestId('btn'));
    expect(onPressMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  it('renders different variants correctly', () => {
    const { getByText } = render(
      <>
        <CommandButton title="Primary" variant="primary" onPress={() => {}} />
        <CommandButton title="Secondary" variant="secondary" onPress={() => {}} />
        <CommandButton title="Danger" variant="danger" onPress={() => {}} />
      </>
    );
    expect(getByText('Primary')).toBeTruthy();
    expect(getByText('Secondary')).toBeTruthy();
    expect(getByText('Danger')).toBeTruthy();
  });

  it('catches and logs errors from onPress without crashing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const onPressMock = jest.fn().mockRejectedValue(new Error('Simulated failure'));

    const { getByText } = render(<CommandButton title="Failing Action" onPress={onPressMock} />);
    fireEvent.press(getByText('Failing Action'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });
});
