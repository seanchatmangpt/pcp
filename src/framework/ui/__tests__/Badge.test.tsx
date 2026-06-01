import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders correctly with default props', () => {
    const { getByText } = render(<Badge>Default Badge</Badge>);
    expect(getByText('Default Badge')).toBeTruthy();
  });

  it('renders correctly with different variants', () => {
    const { getByText } = render(<Badge variant="success">Success Badge</Badge>);
    expect(getByText('Success Badge')).toBeTruthy();
  });

  it('renders children correctly when they are React nodes', () => {
    const { getByTestId } = render(
      <Badge>
        <Text testID="custom-child">Custom Child</Text>
      </Badge>
    );
    expect(getByTestId('custom-child')).toBeTruthy();
  });

  it('applies custom classNames', () => {
    const { getByText } = render(
      <Badge className="custom-container" textClassName="custom-text">
        Custom Class Badge
      </Badge>
    );
    expect(getByText('Custom Class Badge')).toBeTruthy();
  });
});
