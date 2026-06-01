/**
 * @fileoverview Semantic Layout components.
 * Automatically adapts UI based on cultural semantic intent.
 */

import React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';
import { useSemanticI18n } from './SemanticI18nContext';
import { Ionicons } from '@expo/vector-icons';
import { SemanticIntent } from './types';

interface SemanticIntentViewProps extends Omit<ViewProps, 'children'> {
  intentKey: string;
  variables?: Record<string, string>;
  children?: (intent: SemanticIntent) => React.ReactNode;
}

/**
 * A container that adapts its layout and provides semantic intent to its children.
 */
export const SemanticIntentView: React.FC<SemanticIntentViewProps> = ({
  intentKey,
  variables,
  children,
  style,
  ...props
}) => {
  const { translate, isLoading } = useSemanticI18n();

  if (isLoading) return null;

  const intent = translate(intentKey, variables);
  const isRTL = intent.layout === 'rtl';

  return (
    <View
      style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }, style]}
      {...props}>
      {children ? (
        children(intent)
      ) : (
        <>
          {intent.icon && (
            <Ionicons name={intent.icon as any} size={24} style={{ marginHorizontal: 8 }} />
          )}
          <Text style={{ fontSize: 16 }}>{intent.text}</Text>
        </>
      )}
    </View>
  );
};

interface SemanticTextProps extends TextProps {
  intentKey: string;
  variables?: Record<string, string>;
}

/**
 * Text component that automatically translates and adapts based on semantic intent.
 */
export const SemanticText: React.FC<SemanticTextProps> = ({
  intentKey,
  variables,
  style,
  ...props
}) => {
  const { translate, isLoading } = useSemanticI18n();

  if (isLoading) return null;

  const intent = translate(intentKey, variables);

  return (
    <Text style={[{ textAlign: intent.layout === 'rtl' ? 'right' : 'left' }, style]} {...props}>
      {intent.text}
    </Text>
  );
};
