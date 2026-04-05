declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.svg" {
  import React from "react";
  import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

// Allow importing .css files
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

/**
 * React Native's FormData runtime accepts { uri, type, name } objects
 * for file uploads, but the DOM typings only allow Blob | string.
 * This augmentation adds the RN-specific overload so we can append
 * local files without unsafe casts.
 */
interface ReactNativeFormDataFile {
  readonly uri: string;
  readonly type: string;
  readonly name: string;
}

interface FormData {
  append(name: string, value: ReactNativeFormDataFile): void;
}
