import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface CommandButtonProps {
  title: string;
  onPress: () => Promise<any> | void;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  testID?: string;
}

export function CommandButton({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  variant = 'primary',
  testID,
}: CommandButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await onPress();
    } catch (e) {
      console.error('[CommandButton] execution failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          button: styles.secondaryButton,
          text: styles.secondaryText,
          spinner: '#94A3B8',
        };
      case 'danger':
        return {
          button: styles.dangerButton,
          text: styles.dangerText,
          spinner: '#F8FAFC',
        };
      case 'primary':
      default:
        return {
          button: styles.primaryButton,
          text: styles.primaryText,
          spinner: '#F8FAFC',
        };
    }
  };

  const vStyles = getVariantStyles();

  const buttonStyle = [
    styles.baseButton,
    vStyles.button,
    disabled && styles.disabledButton,
    ...(Array.isArray(style) ? style : [style || {}]),
  ];

  const combinedTextStyle = [
    styles.baseText,
    vStyles.text,
    disabled && styles.disabledText,
    ...(Array.isArray(textStyle) ? textStyle : [textStyle || {}]),
  ];

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      style={buttonStyle}
      activeOpacity={0.7}
      testID={testID}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={vStyles.spinner}
          testID={testID ? `${testID}-spinner` : undefined}
        />
      ) : (
        <Text style={combinedTextStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#334155',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  baseText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#94A3B8',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: '#64748B',
  },
});
