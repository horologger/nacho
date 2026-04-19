import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

interface ButtonProps {
  text: string;
  onPress: () => void;
  type: "main" | "secondary" | "danger";
  disabled?: boolean;
}

export function Button({
  text,
  onPress,
  type = "main",
  disabled = false,
}: ButtonProps) {
  const isDanger = type === "danger";

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isDanger ? styles.dangerButton : styles.mainButton,
        disabled &&
          (isDanger ? styles.dangerButtonDisabled : styles.mainButtonDisabled),
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.buttonText,
          isDanger ? styles.dangerButtonText : styles.mainButtonText,
          disabled &&
            (isDanger
              ? styles.dangerButtonTextDisabled
              : styles.mainButtonTextDisabled),
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "400",
  },
  mainButton: {
    backgroundColor: "#FF7B00",
  },
  mainButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  mainButtonDisabled: {
    backgroundColor: "#271300",
  },
  mainButtonTextDisabled: {
    color: "#FFFFFF",
  },
  dangerButton: {
    backgroundColor: "#330000",
  },
  dangerButtonText: {
    color: "#FF0000",
    fontWeight: "600",
  },
  dangerButtonDisabled: {
    backgroundColor: "#1A0000",
  },
  dangerButtonTextDisabled: {
    color: "#800000",
  },
});
