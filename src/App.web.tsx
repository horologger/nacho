import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { StoreProvider, useStore } from "./Store";
import Navigation from "./Navigation";

const App = () => {
  return (
    <View style={styles.webContainer}>
      <View style={styles.mobileViewport}>
        <Navigation />
      </View>
    </View>
  );
};

export default function () {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    // @ts-ignore - web-only style
    minHeight: "100vh",
    // @ts-ignore - web-only style
    width: "100vw",
  },
  mobileViewport: {
    width: 390,
    // @ts-ignore - web-only style
    height: "100vh",
    maxHeight: 844,
    backgroundColor: "#000000",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
});
