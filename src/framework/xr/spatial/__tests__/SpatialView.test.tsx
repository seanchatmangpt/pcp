import React from 'react';
import { render } from '@testing-library/react-native';
import { SpatialView } from '../SpatialView';
import { Text } from 'react-native';

describe('SpatialView', () => {
  it('should render children', () => {
    const { getByText } = render(
      <SpatialView>
        <Text>Test Child</Text>
      </SpatialView>
    );

    expect(getByText('Test Child')).toBeTruthy();
  });

  it('should apply spatial transformation styles', () => {
    const transform = {
      position: { x: 10, y: 20, z: 30 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    };

    const { getByTestId } = render(
      <SpatialView transform={transform} testID="spatial-view">
        <Text>Content</Text>
      </SpatialView>
    );

    const view = getByTestId('spatial-view');
    const style = view.props.style;

    // Check if flattened transform styles are applied
    const flattenedStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;

    expect(flattenedStyle.transform).toContainEqual({ translateX: 10 });
    expect(flattenedStyle.transform).toContainEqual({ translateY: 20 });
    expect(flattenedStyle.transform).toContainEqual({ scale: 1.5 });
    expect(flattenedStyle.transform).toContainEqual({ rotateX: '0.1rad' });
    expect(flattenedStyle.transform).toContainEqual({ rotateY: '0.2rad' });
    expect(flattenedStyle.transform).toContainEqual({ rotateZ: '0.3rad' });
  });

  it('should apply depth as zIndex', () => {
    const { getByTestId } = render(
      <SpatialView depth={5} testID="spatial-view-depth">
        <Text>Content</Text>
      </SpatialView>
    );

    const view = getByTestId('spatial-view-depth');
    const flattenedStyle = Array.isArray(view.props.style)
      ? Object.assign({}, ...view.props.style)
      : view.props.style;

    expect(flattenedStyle.zIndex).toBe(5);
  });

  it('should pass through XR specific props', () => {
    const transform = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    const { getByTestId } = render(
      <SpatialView isVolumetric={true} transform={transform} testID="spatial-view-xr">
        <Text>Content</Text>
      </SpatialView>
    );

    const view = getByTestId('spatial-view-xr');
    expect(view.props.isVolumetric).toBe(true);
    expect(view.props.spatialTransform).toEqual(transform);
  });
});
