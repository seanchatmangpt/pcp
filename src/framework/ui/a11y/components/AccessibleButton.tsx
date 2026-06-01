import { Pressable } from 'react-native';
import { withA11y } from '../hocs/withA11y';

/**
 * A Pressable component with built-in accessibility support via withA11y HOC.
 * Defaults role to 'button'.
 */
const BaseAccessibleButton = withA11y(Pressable);

export const AccessibleButton = (props: React.ComponentProps<typeof BaseAccessibleButton>) => {
  return <BaseAccessibleButton role="button" {...props} />;
};
