import { forwardRef } from "react";
import { TextInput as NativeTextInput, TextInputProps } from "react-native";
import { useI18n } from "../lib/i18n";
import { resolveFont } from "../lib/typography";

export type TextInput = NativeTextInput;
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => {
  const { isRTL } = useI18n();
  return <NativeTextInput {...props} ref={ref} style={[{
    direction: "ltr",
    fontFamily: resolveFont(isRTL),
    writingDirection: isRTL ? "rtl" : "ltr",
    textAlign: isRTL ? "right" : "left",
  }, style]} />;
});
TextInput.displayName = "LocalizedTextInput";
