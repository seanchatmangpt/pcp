import 'react-native';
import 'react';

/// <reference types="nativewind/types" />

declare module 'react-native' {
  interface ViewProps { className?: string; }
  interface TextProps { className?: string; }
  interface ImageProps { className?: string; }
  interface PressableProps { className?: string; }
}

declare module 'react' {
  interface Attributes { className?: string; }
}
