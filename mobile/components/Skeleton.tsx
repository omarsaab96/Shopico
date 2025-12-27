import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";

export function Skeleton({
  width = 150,
  height = 14,
  borderRadius=20,
  colorScheme = "light",
  style = {},
}) {
  const shimmerX = useRef(new Animated.Value(-width)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const radius = borderRadius ?? height / 2;

  // Base colors
  const baseStart = colorScheme === "dark" ? "#2a2a2a" : "#e0e0e0";
  const baseEnd   = colorScheme === "dark" ? "#333333" : "#f0f0f0";
  const highlight = colorScheme === "dark" ? "#4a4a4a" : "#ffffff";

  const animatedBaseColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [baseStart, baseEnd],
  });

  useEffect(() => {
    const shimmerAnim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: width,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false, // color animation ❗
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );

    shimmerAnim.start();
    pulseAnim.start();

    return () => {
      shimmerAnim.stop();
      pulseAnim.stop();
    };
  }, [width]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
        //   backgroundColor: animatedBaseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            height,
            backgroundColor: highlight,
            transform: [{ translateX: shimmerX }],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    width: "45%",
    opacity: 0.35,
  },
});
