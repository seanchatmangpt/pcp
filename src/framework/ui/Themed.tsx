/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text as DefaultText, View as DefaultView } from 'react-native';

import { useTheme } from './theme/useTheme';
import { cn } from '../../utils/cn';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemedColor(styleType: 'text' | 'background') {
  const theme = useTheme();

  if (styleType === 'background') {
    return 'bg-background';
  } else if (styleType === 'text') {
    return 'text-text';
  }
}

export function Text(props: TextProps) {
  const { className, style, ...otherProps } = props;
  const theme = useTheme();

  const dynamicStyle = {
    color: theme.colors.text,
    fontSize: 16 * theme.fontScale,
  };

  return <DefaultText style={[dynamicStyle, style]} className={className} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { className, style, ...otherProps } = props;
  const theme = useTheme();

  const dynamicStyle = {
    backgroundColor: theme.colors.background,
  };

  return <DefaultView style={[dynamicStyle, style]} className={className} {...otherProps} />;
}
