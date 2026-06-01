import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, SafeAreaView } from 'react-native';
import { GenerativeViewProps, LayoutNode } from './types';
import { useGenerativeLayout } from './hooks/useGenerativeLayout';
import { cn } from '../../../utils/cn';
import { useTheme } from '../theme/useTheme';

/**
 * A highly intelligent, dynamic UI component that generates its structure from semantic intent.
 * Zero boilerplate, fully themed, and accessible by design.
 */
export const GenerativeView: React.FC<GenerativeViewProps> = ({
  schema,
  data,
  className,
  onAction,
  ...props
}) => {
  const { header, body, footer } = useGenerativeLayout(schema, data);
  const theme = useTheme();

  // Iron Law Fallback: Always extract and render critical action intents deterministically
  const criticalActions = useMemo(() => {
    return schema.fields.filter((f) => f.predicate?.includes('schema.org/Action') || f.required);
  }, [schema]);

  const renderNode = (node: LayoutNode) => {
    const { field, value, hint, key } = node;

    const containerStyle = cn(
      'p-4 mb-2 rounded-xl bg-card border border-border shadow-sm',
      hint.span === 1 && 'flex-1',
      hint.span === 2 && 'w-1/2',
      hint.span === 3 && 'w-3/4',
      hint.span === 4 && 'w-full',
      hint.variant === 'hero' && 'bg-primary/10 border-primary/20 p-6',
      hint.variant === 'compact' && 'p-2'
    );

    const labelStyle = cn(
      'text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1',
      hint.variant === 'hero' && 'text-primary'
    );

    const valueStyle = cn(
      'text-base text-text',
      hint.variant === 'hero' && 'text-2xl font-bold',
      field.type === 'uri' && 'text-blue-500 underline'
    );

    return (
      <Pressable key={key} className={containerStyle} onPress={() => onAction?.(key, value)}>
        {field.label && <Text className={labelStyle}>{field.label}</Text>}
        {field.format === 'image' ? (
          <Image
            source={{ uri: value }}
            className="w-full h-40 rounded-lg mt-2"
            resizeMode="cover"
          />
        ) : (
          <Text className={valueStyle}>
            {field.type === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '')}
          </Text>
        )}
        {field.description && (
          <Text className="text-xs text-muted-foreground mt-1 italic">{field.description}</Text>
        )}
      </Pressable>
    );
  };

  return (
    <View className={cn('flex-1 w-full', className)} {...props}>
      {schema.title && (
        <Text className="text-3xl font-extrabold text-text mb-6 px-4">{schema.title}</Text>
      )}

      {header.length > 0 && (
        <View className="flex-row flex-wrap px-2 mb-4">{header.map(renderNode)}</View>
      )}

      {body.length > 0 && <View className="px-2">{body.map(renderNode)}</View>}

      {footer.length > 0 && (
        <View className="flex-row flex-wrap px-2 mt-4 border-t border-border pt-4">
          {footer.map(renderNode)}
        </View>
      )}

      {/* Iron Law Enforcement Layer: Deterministic rendering of critical actions */}
      {criticalActions.length > 0 && (
        <SafeAreaView
          className="p-4 border-t border-red-500/30 bg-card mt-auto"
          testID="iron-law-fallback">
          <Text className="text-xs font-bold text-red-500 mb-2 uppercase">Critical Actions</Text>
          {criticalActions.map((action) => (
            <Pressable
              key={`fallback-${action.predicate || action.key}`}
              className="p-3 bg-red-500/10 rounded-lg mb-2"
              onPress={() =>
                onAction?.(action.predicate || action.key, data[action.predicate || action.key])
              }>
              <Text className="text-red-700 font-semibold">{action.label}</Text>
            </Pressable>
          ))}
        </SafeAreaView>
      )}
    </View>
  );
};

GenerativeView.displayName = 'GenerativeView';
