import { AlertManager } from '../AlertManager';
import { Alert, Platform } from 'react-native';

describe('AlertManager', () => {
  let originalWindow: any;
  let alertSpy: jest.SpyInstance;

  beforeAll(() => {
    originalWindow = global.window;
  });

  afterAll(() => {
    global.window = originalWindow;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('delegates to RNAlert.alert on non-web platforms', () => {
    const title = 'Test Title';
    const message = 'Test Message';
    const buttons = [{ text: 'OK', onPress: jest.fn() }];
    const options = { cancelable: true };

    AlertManager.alert(title, message, buttons, options);

    expect(Alert.alert).toHaveBeenCalledWith(title, message, buttons, options);
  });

  describe('Web target behavior', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      global.window = {
        alert: jest.fn(),
        confirm: jest.fn(),
      } as any;
    });

    it('defers alert invocation to next tick via setTimeout', () => {
      AlertManager.alert('Web Title', 'Web Message');

      // Alert should not be called immediately because it is wrapped in setTimeout
      expect(global.window.alert).not.toHaveBeenCalled();

      // Fast-forward timers
      jest.runAllTimers();

      expect(global.window.alert).toHaveBeenCalledWith('Web Title\n\nWeb Message');
    });

    it('handles Web alert with no buttons and triggers onDismiss option', () => {
      const onDismissMock = jest.fn();
      AlertManager.alert('Title', 'Message', [], { onDismiss: onDismissMock });

      jest.runAllTimers();

      expect(global.window.alert).toHaveBeenCalledWith('Title\n\nMessage');
      expect(onDismissMock).toHaveBeenCalled();
    });

    it('uses window.confirm if a button has style "cancel"', () => {
      const actionPress = jest.fn();
      const cancelPress = jest.fn();
      const buttons = [
        { text: 'Cancel', style: 'cancel' as const, onPress: cancelPress },
        { text: 'OK', onPress: actionPress },
      ];

      (global.window.confirm as jest.Mock).mockReturnValue(true);

      AlertManager.alert('Confirm Title', 'Confirm Message', buttons);
      jest.runAllTimers();

      expect(global.window.confirm).toHaveBeenCalledWith('Confirm Title\n\nConfirm Message');
      expect(actionPress).toHaveBeenCalled();
      expect(cancelPress).not.toHaveBeenCalled();
    });

    it('triggers cancel button action if window.confirm is rejected', () => {
      const actionPress = jest.fn();
      const cancelPress = jest.fn();
      const buttons = [
        { text: 'Cancel', style: 'cancel' as const, onPress: cancelPress },
        { text: 'OK', onPress: actionPress },
      ];

      (global.window.confirm as jest.Mock).mockReturnValue(false);

      AlertManager.alert('Confirm Title', 'Confirm Message', buttons);
      jest.runAllTimers();

      expect(global.window.confirm).toHaveBeenCalledWith('Confirm Title\n\nConfirm Message');
      expect(cancelPress).toHaveBeenCalled();
      expect(actionPress).not.toHaveBeenCalled();
    });

    it('handles alert without cancel buttons by calling alert and executing the first action', () => {
      const actionPress = jest.fn();
      const buttons = [{ text: 'OK', onPress: actionPress }];

      AlertManager.alert('Title', 'Message', buttons);
      jest.runAllTimers();

      expect(global.window.alert).toHaveBeenCalledWith('Title\n\nMessage');
      expect(actionPress).toHaveBeenCalled();
    });
  });
});
