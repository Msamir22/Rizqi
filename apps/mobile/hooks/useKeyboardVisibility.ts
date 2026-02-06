import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * Custom hook to track whether the keyboard is currently visible.
 * Useful for hiding UI elements (like fixed buttons) that would be covered by the keyboard.
 *
 * @returns boolean - true if keyboard is visible, false otherwise
 */
export function useKeyboardVisibility(): boolean {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  return isKeyboardVisible;
}
