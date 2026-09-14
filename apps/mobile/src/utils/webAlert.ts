/**
 * Alert.alert в браузере.
 *
 * В react-native-web Alert.alert — пустая функция: «Бобо не ответил», «нужно
 * согласие на голос», «удалить профиль?» в веб-превью молча пропадали, и экран
 * просто ничего не делал. Здесь — системные окна браузера: одна кнопка → alert,
 * отмена и действие → confirm. На телефоне ничего не меняется.
 */
import { Alert, Platform, type AlertButton } from 'react-native';

export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const action = buttons.find((b) => b !== cancel);
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}
