import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";

export function Shimmer({
  width = 150,
  height = 14,
  borderRadius = 6,
  colorScheme = "light",
  style = {},
}) {
  const translateX = useRef(new Animated.Value(-width)).current;

  const baseColor = colorScheme === "dark" ? "#2a2a2a" : "#e0e0e0";
  const highlightColor = colorScheme === "dark" ? "#3a3a3a" : "#f2f2f2";

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1200,
        useNativeDriver: true,
      })
    );

    anim.start();
    return () => anim.stop();
  }, [width]);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: highlightColor,
            height,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    width: "40%",
    opacity: 0.6,
  },
});
