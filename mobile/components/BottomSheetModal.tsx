import { forwardRef } from "react";
import { BottomSheetModal as GorhomBottomSheetModal, BottomSheetModalProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type BottomSheetModal = GorhomBottomSheetModal;

// The shared portal covers the entire window, including the system navigation area.
export const BottomSheetModal = forwardRef<GorhomBottomSheetModal, BottomSheetModalProps>(
  ({ bottomInset, ...props }, ref) => {
    const insets = useSafeAreaInsets();
    return <GorhomBottomSheetModal {...props} ref={ref} bottomInset={bottomInset ?? insets.bottom} />;
  }
);

BottomSheetModal.displayName = "SafeAreaBottomSheetModal";
export default BottomSheetModal;
