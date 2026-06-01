import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  AvatarRelativeProjectionMatrixView,
  StackProtected,
  TabsProtected,
  Stack,
  Tabs,
} from '../AvatarRelativeProjection';

jest.mock('expo-router', () => {
  const React = require('react');
  const StackComponent = React.forwardRef(
    (
      { children, ...props }: { children?: React.ReactNode; [key: string]: any },
      ref: React.Ref<any>
    ) => <>{children}</>
  );
  const TabsComponent = React.forwardRef(
    (
      { children, ...props }: { children?: React.ReactNode; [key: string]: any },
      ref: React.Ref<any>
    ) => <>{children}</>
  );
  return {
    Stack: Object.assign(StackComponent, { Screen: () => null }),
    Tabs: Object.assign(TabsComponent, { Screen: () => null }),
  };
});

jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesome');

jest.mock('../../../lib/truex/avatar/matrix', () => ({
  PROJECTION_MATRIX: {
    volunteer_shortage: jest.fn((data, role) => {
      if (role === 'guest')
        return { visible: false, surface: 'none', allowedActions: [], payload: null };
      return {
        visible: true,
        surface: 'dashboard',
        allowedActions: ['notify'],
        payload: {
          message: 'Shortage info',
          openSlots: data.openSlots,
          candidates: data.candidates,
          shortageRatio: data.shortageRatio,
          runId: data.runId,
          history: data.history,
          topology: data.topology,
          stateHash: data.stateHash,
        },
      };
    }),
  },
}));

describe('AvatarRelativeProjection', () => {
  describe('StackProtected', () => {
    it('renders children when guard is true', () => {
      const { getByText } = render(
        <StackProtected guard={true}>
          <Text>Content</Text>
        </StackProtected>
      );
      expect(getByText('Content')).toBeTruthy();
    });

    it('renders null when guard is false', () => {
      const { queryByText } = render(
        <StackProtected guard={false}>
          <Text>Content</Text>
        </StackProtected>
      );
      expect(queryByText('Content')).toBeNull();
    });
  });

  describe('TabsProtected', () => {
    it('renders children when guard is true', () => {
      const { getByText } = render(
        <TabsProtected guard={true}>
          <Text>Content</Text>
        </TabsProtected>
      );
      expect(getByText('Content')).toBeTruthy();
    });

    it('renders null when guard is false', () => {
      const { queryByText } = render(
        <TabsProtected guard={false}>
          <Text>Content</Text>
        </TabsProtected>
      );
      expect(queryByText('Content')).toBeNull();
    });
  });

  describe('Stack and Tabs Components', () => {
    it('renders Stack and memoizes children', () => {
      const { rerender } = render(
        <Stack screenOptions={{ title: 'test' }}>
          <StackProtected guard={true}>
            <Text>Child1</Text>
          </StackProtected>
          <StackProtected guard={false}>
            <Text>Child2</Text>
          </StackProtected>
          <Text>Child3</Text>
        </Stack>
      );
      // Re-render with equivalent props
      rerender(
        <Stack screenOptions={{ title: 'test' }}>
          <StackProtected guard={true}>
            <Text>Child1</Text>
          </StackProtected>
          <StackProtected guard={false}>
            <Text>Child2</Text>
          </StackProtected>
          <Text>Child3</Text>
        </Stack>
      );
      // Re-render with non-equivalent props
      rerender(
        <Stack screenOptions={{ title: 'test2' }}>
          <StackProtected guard={true}>
            <Text>Child1</Text>
          </StackProtected>
        </Stack>
      );
    });

    it('renders Tabs and memoizes children', () => {
      const { rerender } = render(
        <Tabs screenOptions={{ title: 'test' }}>
          <TabsProtected guard={true}>
            <Text>Child1</Text>
          </TabsProtected>
          <TabsProtected guard={false}>
            <Text>Child2</Text>
          </TabsProtected>
          <Text>Child3</Text>
        </Tabs>
      );
      rerender(
        <Tabs screenOptions={{ title: 'test' }}>
          <TabsProtected guard={true}>
            <Text>Child1</Text>
          </TabsProtected>
          <TabsProtected guard={false}>
            <Text>Child2</Text>
          </TabsProtected>
          <Text>Child3</Text>
        </Tabs>
      );
    });
  });

  describe('AvatarRelativeProjectionMatrixView', () => {
    it('renders interactive controls and grid', () => {
      const { getByText, getAllByText } = render(<AvatarRelativeProjectionMatrixView />);
      expect(getByText('Interactive Projection Control')).toBeTruthy();
      expect(getByText('Evaluated Projection Grid')).toBeTruthy();
      expect(getAllByText('DASHBOARD').length).toBeGreaterThan(0);
    });

    it('can increase and decrease open slots', () => {
      const { getByLabelText, getByText } = render(<AvatarRelativeProjectionMatrixView />);
      const increaseBtn = getByLabelText('Increase open slots');
      const decreaseBtn = getByLabelText('Decrease open slots');

      expect(getByText('Open Slots: 4')).toBeTruthy();

      fireEvent.press(increaseBtn);
      expect(getByText('Open Slots: 5')).toBeTruthy();

      fireEvent.press(decreaseBtn);
      expect(getByText('Open Slots: 4')).toBeTruthy();
    });

    it('can select step from slider', () => {
      const { getByLabelText, getByText } = render(<AvatarRelativeProjectionMatrixView />);
      const stepBtn = getByLabelText('Set open slots to 7');

      fireEvent.press(stepBtn);
      expect(getByText('Open Slots: 7')).toBeTruthy();
    });

    it('can add and remove candidate', () => {
      const { getByLabelText, getByText, queryByText } = render(
        <AvatarRelativeProjectionMatrixView initialData={{ candidates: ['Alice'] }} />
      );

      expect(getByText('Candidates (1)')).toBeTruthy();
      expect(getByText('Alice')).toBeTruthy();

      const addBtn = getByLabelText('Add Candidate');
      fireEvent.press(addBtn);
      expect(getByText('Candidates (2)')).toBeTruthy();

      const removeBtn = getByLabelText('Remove candidate Alice');
      fireEvent.press(removeBtn);
      expect(queryByText('Alice')).toBeNull();
      expect(getByText('Candidates (1)')).toBeTruthy();
    });

    it('handles state hash input', () => {
      const { getByPlaceholderText } = render(<AvatarRelativeProjectionMatrixView />);
      const input = getByPlaceholderText('State hash (e.g. vkg_genesis_a4f9)');
      fireEvent.changeText(input, 'new_hash');
      expect(input.props.value).toBe('new_hash');
    });
  });
});
