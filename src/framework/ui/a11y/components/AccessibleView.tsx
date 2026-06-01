import { View } from 'react-native';
import { withA11y } from '../hocs/withA11y';

/**
 * A View component with built-in accessibility support via withA11y HOC.
 */
export const AccessibleView = withA11y(View);
