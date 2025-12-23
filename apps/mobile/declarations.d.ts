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
