import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Handles, useStore } from "@/Store";
import OnboardingHome from "./screens/onboarding/Home";
import ShowMnemonic from "./screens/onboarding/ShowMnemonic";
import ImportKeystore from "./screens/onboarding/ImportKeystore";
import EnterMnemonic from "./screens/onboarding/EnterMnemonic";
import ListHandles from "./screens/main/ListHandles";
import ShowHandle from "./screens/main/ShowHandle";
import AddHandle from "./screens/main/AddHandle";
import ImportCertificate from "./screens/main/ImportCertificate";
import SignNostrEvent from "./screens/main/SignNostrEvent";

export type RootStackParamList = {
  Main: undefined;
  Onboarding: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export type OnboardingStackParamList = {
  Home: undefined;
  ShowMnemonic: undefined;
  ImportKeystore: undefined;
  EnterMnemonic: { xpub: string; handles?: Handles };
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

export type HandlesStackParamList = {
  ListHandles: undefined;
  ShowHandle: { handle: string };
  AddHandle: { initialHandle?: string };
  ImportCertificate: undefined;
  SignNostrEvent: { handle: string };
};

const HandlesStack = createNativeStackNavigator<HandlesStackParamList>();

const screenOptions = {
  headerShown: true,
  headerStyle: {
    backgroundColor: "#000000",
  },
  headerTintColor: "#FFFFFF",
  headerTitleStyle: {
    fontWeight: "600" as const,
    fontSize: 18,
  },
  headerBackTitleVisible: false,
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: "#000000",
  },
};

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={screenOptions}>
      <OnboardingStack.Screen
        name="Home"
        component={OnboardingHome}
        options={{ headerShown: false }}
      />
      <OnboardingStack.Screen
        name="ShowMnemonic"
        component={ShowMnemonic}
        options={{ title: "Seed Phrase" }}
      />
      <OnboardingStack.Screen
        name="ImportKeystore"
        component={ImportKeystore}
        options={{ title: "Keystore" }}
      />
      <OnboardingStack.Screen
        name="EnterMnemonic"
        component={EnterMnemonic}
        options={{ title: "Seed Phrase" }}
      />
    </OnboardingStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <HandlesStack.Navigator
      screenOptions={screenOptions}
      initialRouteName="ListHandles"
    >
      <HandlesStack.Screen
        name="ListHandles"
        component={ListHandles}
        options={{ title: "Handles" }}
      />
      <HandlesStack.Screen
        name="ShowHandle"
        component={ShowHandle}
        options={{ title: "Handles" }}
      />
      <HandlesStack.Screen
        name="AddHandle"
        component={AddHandle}
        options={{ title: "Handles" }}
      />
      <HandlesStack.Screen
        name="ImportCertificate"
        component={ImportCertificate}
        options={{ title: "Certificate" }}
      />
      <HandlesStack.Screen
        name="SignNostrEvent"
        component={SignNostrEvent}
        options={{ title: "Nostr Event" }}
      />
    </HandlesStack.Navigator>
  );
}

export default function RootNavigator() {
  const { xpub, handles } = useStore();
  const isConfigured = xpub !== null && handles !== null;

  return (
    <NavigationContainer
      linking={undefined}
      onStateChange={undefined}
      theme={{
        dark: true,
        colors: {
          primary: "#FF7B00",
          background: "#000000",
          card: "#000000",
          text: "#FFFFFF",
          border: "#333333",
          notification: "#FF7B00",
        },
        fonts: {
          regular: {
            fontFamily: "System",
            fontWeight: "400",
          },
          medium: {
            fontFamily: "System",
            fontWeight: "500",
          },
          bold: {
            fontFamily: "System",
            fontWeight: "700",
          },
          heavy: {
            fontFamily: "System",
            fontWeight: "900",
          },
        },
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#000000" },
        }}
      >
        {isConfigured ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
