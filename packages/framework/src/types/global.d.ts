declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'three' {
  export class Points {
    rotation: { x: number; y: number; z: number };
    scale: { set(x: number, y: number, z: number): void };
  }
  export class BufferGeometry {}
  export class PointsMaterial {}
}

declare module '@react-three/fiber/native' {
  import { ComponentType } from 'react';
  export const Canvas: ComponentType<any>;
  export function useFrame(callback: (state: any, delta: number) => void): void;
}

declare module '@shopify/react-native-skia' {
  import { ComponentType } from 'react';
  export const Canvas: ComponentType<any>;
  export const Rect: ComponentType<any>;
  export const Shader: ComponentType<any>;
  export function useSharedValue(initialValue: number): { value: number };
  export function useTime(): { value: number };
}

declare module 'expo-haptics' {
  export enum NotificationFeedbackType {
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
  }
  export enum ImpactFeedbackStyle {
    Light = 'light',
    Medium = 'medium',
    Heavy = 'heavy',
    Rigid = 'rigid',
    Soft = 'soft',
  }
  export function notificationAsync(type: NotificationFeedbackType): Promise<void>;
  export function impactAsync(style: ImpactFeedbackStyle): Promise<void>;
  export function selectionAsync(): Promise<void>;
}
