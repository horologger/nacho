import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TouchableOpacity, Text } from "react-native";
import { Handles, Network, useStore } from "@/Store";
import OnboardingHome from "./screens/onboarding/Home";
import ShowMnemonic from "./screens/onboarding/ShowMnemonic";
import ImportKeystore from "./screens/onboarding/ImportKeystore";
import EnterMnemonic from "./screens/onboarding/EnterMnemonic";
import RestoreMnemonic from "./screens/onboarding/RestoreMnemonic";
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
  RestoreMnemonic: undefined;
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

export type HandlesStackParamList = {
  ListHandles: { network: Network };
  ShowHandle: { network: Network; handle: string };
  AddHandle: { network: Network; initialHandle?: string };
  ImportCertificate: { network: Network };
  SignNostrEvent: { network: Network; handle: string };
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
      <OnboardingStack.Screen
        name="RestoreMnemonic"
        component={RestoreMnemonic}
        options={{ title: "Seed Phrase" }}
      />
    </OnboardingStack.Navigator>
  );
}

function MainNavigator() {
  const networkSwitcher = (navigation: any, network: Network) => {
    const newNetwork: Network = network === "testnet4" ? "mainnet" : "testnet4";
    const displayName = network === "mainnet" ? "Mainnet" : "Testnet";
    return (
      <TouchableOpacity
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: "ListHandles", params: { network: newNetwork } }],
          })
        }
        style={{ paddingRight: 16 }}
      >
        <Text style={{ color: "#FF7B00", fontSize: 16, fontWeight: "400" }}>
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <HandlesStack.Navigator
      screenOptions={screenOptions}
      initialRouteName="ListHandles"
    >
      <HandlesStack.Screen
        name="ListHandles"
        component={ListHandles}
        options={({ navigation, route }) => ({
          title: "Handles",
          headerRight: () => networkSwitcher(navigation, route.params.network),
        })}
        initialParams={{ network: "mainnet" }}
        getId={({ params }) => params.network}
      />
      <HandlesStack.Screen
        name="ShowHandle"
        component={ShowHandle}
        options={({ navigation, route }) => ({
          title: "Handles",
          headerRight: () => networkSwitcher(navigation, route.params.network),
        })}
        getId={({ params }) => `${params.network}-${params.handle}`}
      />
      <HandlesStack.Screen
        name="AddHandle"
        component={AddHandle}
        options={({ navigation, route }) => ({
          title: "Handles",
          headerRight: () => networkSwitcher(navigation, route.params.network),
        })}
        getId={({ params }) => params.network}
      />
      <HandlesStack.Screen
        name="ImportCertificate"
        component={ImportCertificate}
        options={({ navigation, route }) => ({
          title: "Certificate",
          headerRight: () => networkSwitcher(navigation, route.params.network),
        })}
      />
      <HandlesStack.Screen
        name="SignNostrEvent"
        component={SignNostrEvent}
        options={({ navigation, route }) => ({
          title: "Nostr Event",
          headerRight: () => networkSwitcher(navigation, route.params.network),
        })}
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
