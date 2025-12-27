import React, { useEffect, useRef } from "react";
import { Animated, } from "react-native";

export function Pulse({ width = 150, height = 50, style = {}, colorScheme = "light" }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, []);


  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: colorScheme === "dark" ? "#2a2a2a" : "#e0e0e0",
          opacity,
        },
        style,
      ]}
    />
  );
}
