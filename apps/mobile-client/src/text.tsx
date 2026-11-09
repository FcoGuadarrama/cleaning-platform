import { Text as NativeText, type TextProps } from "react-native";

const WEIGHT = /\bfont-(normal|medium|semibold|bold|extrabold)\b/;

/** Text in the brand typeface: regular weight unless the classes pick another one. */
export function Text({ className = "", ...props }: TextProps & { className?: string }) {
  return <NativeText {...props} className={WEIGHT.test(className) ? className : `font-normal ${className}`} />;
}
