import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { cn } from '../../utils/cn';

/**
 * Variants available for the Badge component.
 */
export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'outline';

/**
 * Props for the Badge primitive.
 */
export interface BadgeProps extends ViewProps {
  /**
   * The visual variant of the badge.
   * @default 'default'
   */
  variant?: BadgeVariant;
  /**
   * Optional custom class name for the text inside the badge.
   */
  textClassName?: string;
  /**
   * The content of the badge.
   */
  children?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-900 dark:bg-neutral-100',
  primary: 'bg-blue-600 dark:bg-blue-500',
  secondary: 'bg-neutral-200 dark:bg-neutral-800',
  success: 'bg-green-500 dark:bg-green-600',
  warning: 'bg-yellow-500 dark:bg-yellow-600',
  destructive: 'bg-red-500 dark:bg-red-600',
  outline: 'border border-neutral-300 dark:border-neutral-700 bg-transparent',
};

const textVariantStyles: Record<BadgeVariant, string> = {
  default: 'text-white dark:text-black',
  primary: 'text-white',
  secondary: 'text-neutral-900 dark:text-neutral-100',
  success: 'text-white',
  warning: 'text-white',
  destructive: 'text-white',
  outline: 'text-neutral-900 dark:text-neutral-100',
};

/**
 * A customizable Badge primitive to display small amounts of information.
 */
export function Badge({
  variant = 'default',
  className,
  textClassName,
  children,
  ...props
}: BadgeProps) {
  const containerClasses = cn(
    'px-2.5 py-0.5 rounded-full items-center justify-center flex-row',
    variantStyles[variant],
    className
  );

  const textClasses = cn('text-xs font-semibold', textVariantStyles[variant], textClassName);

  return (
    <View className={containerClasses} {...props}>
      {typeof children === 'string' ? <Text className={textClasses}>{children}</Text> : children}
    </View>
  );
}
