import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface LayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  overlay?: boolean;
  scrollable?: boolean;
}

export function Layout({
  children,
  footer,
  overlay = false,
  scrollable = true,
}: LayoutProps) {
  const insets = useSafeAreaInsets();

  const content = scrollable ? (
    <KeyboardAwareScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {overlay && <View style={styles.overlay} />}
      {content}
      {footer && (
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  footer: {
    backgroundColor: "#000000",
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 5,
  },
});
