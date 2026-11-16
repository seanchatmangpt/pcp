import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
} from 'react-native';

export interface KeyboardSafeFormProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  dismissOnTap?: boolean;
  className?: string;
  testID?: string;
}

export const KeyboardSafeForm: React.FC<KeyboardSafeFormProps> = ({
  children,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  dismissOnTap = true,
  className,
  testID,
}) => {
  const innerContent = dismissOnTap ? (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} testID="keyboard-dismiss-pressable">
      <View style={styles.innerView}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  ) : (
    children
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, style]}
      className={className}
      testID={testID}
    >
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={contentContainerStyle}
        style={styles.scrollView}
      >
        {innerContent}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  innerView: {
    flex: 1,
  },
});
