import React from 'react';
import { View, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { withA11y } from '../hocs/withA11y';

const MockComponent = React.forwardRef<View, { testID?: string; children?: React.ReactNode }>(
  (props, ref) => (
    <View ref={ref} {...props}>
      {props.children}
    </View>
  )
);

const EnhancedComponent = withA11y(MockComponent);

describe('withA11y', () => {
  it('passes a11y props to the wrapped component', () => {
    const { getByTestId } = render(
      <EnhancedComponent testID="enhanced" label="Enhanced Label" role="header" busy={true} />
    );

    const component = getByTestId('enhanced');
    expect(component.props.accessibilityLabel).toBe('Enhanced Label');
    expect(component.props.accessibilityRole).toBe('header');
    expect(component.props.accessibilityState).toEqual({ busy: true });
  });

  it('preserves other props', () => {
    const { getByText } = render(
      <EnhancedComponent label="Test">
        <Text>Inner Text</Text>
      </EnhancedComponent>
    );

    expect(getByText('Inner Text')).toBeTruthy();
  });

  it('forwards the ref', () => {
    const ref = React.createRef<View>();
    render(<EnhancedComponent ref={ref} label="Test" />);
    expect(ref.current).toBeTruthy();
  });
});
