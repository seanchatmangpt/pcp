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
});
