import React, { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Extra space beyond safe-area bottom (mobile browser toolbars, in-app overlays). */
const BOTTOM_UI_CLEARANCE = 50;

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
  const bottomPad = insets.bottom + BOTTOM_UI_CLEARANCE;

  const content = scrollable ? (
    <KeyboardAwareScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.content, { paddingBottom: bottomPad }]}>{children}</View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {overlay && <View style={styles.overlay} />}
      {content}
      {footer && (
        <View style={[styles.footer, { paddingBottom: bottomPad }]}>
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
    paddingTop: 12,
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
