import React from "react";
import { View } from "react-native";

const MapView = React.forwardRef<View, any>((props, ref) => (
  <View ref={ref as any} {...props} />
));

export const Marker = ({ children, ...props }: any) => <View {...props}>{children}</View>;
export const Polyline = () => null;

export default MapView;
