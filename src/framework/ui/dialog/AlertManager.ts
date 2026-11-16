import { Alert as RNAlert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export class AlertManager {
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    if (Platform.OS !== 'web') {
      RNAlert.alert(title, message, buttons, options);
      return;
    }

    // Web Fallback: wraps platform actions inside non-blocking setTimeout callbacks
    setTimeout(() => {
      const hasWindow = typeof window !== 'undefined';
      if (!buttons || buttons.length === 0) {
        if (hasWindow) {
          window.alert(`${title}${message ? '\n\n' + message : ''}`);
        }
        options?.onDismiss?.();
        return;
      }

      const hasCancel = buttons.some(b => b.style === 'cancel');
      if (hasCancel) {
        const confirmed = hasWindow ? window.confirm(`${title}${message ? '\n\n' + message : ''}`) : false;
        const actionButton = buttons.find(b => b.style !== 'cancel');
        const cancelButton = buttons.find(b => b.style === 'cancel');
        if (confirmed) {
          actionButton?.onPress?.();
        } else {
          cancelButton?.onPress?.();
        }
      } else {
        if (hasWindow) {
          window.alert(`${title}${message ? '\n\n' + message : ''}`);
        }
        buttons[0]?.onPress?.();
      }
    }, 0);
  }
}
