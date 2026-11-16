import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

interface StaggerProps {
  /**
   * Stagger delay between children in milliseconds.
   * @default 100
   */
  stagger?: number;
  /**
   * Initial delay before the first child starts animating.
   * @default 0
   */
  initialDelay?: number;
  /**
   * Optional style for the container.
   */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A utility component to stagger the animation of its children.
 * Works by injecting a `delay` prop into children if they support it.
 *
 * @example
 * <Stagger stagger={50}>
 *   <FadeIn><Text>Item 1</Text></FadeIn>
 *   <FadeIn><Text>Item 2</Text></FadeIn>
 *   <FadeIn><Text>Item 3</Text></FadeIn>
 * </Stagger>
 */
export const Stagger: React.FC<StaggerProps> = ({
  children,
  stagger = 100,
  initialDelay = 0,
  style,
}) => {
  return (
    <View style={style}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) {
          return child;
        }

        const typedChild = child as React.ReactElement<any>;
        return React.cloneElement(typedChild, {
          delay: (typedChild.props.delay || 0) + initialDelay + index * stagger,
        });
      })}
    </View>
  );
};
