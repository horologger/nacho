import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { RouteProp } from "@react-navigation/native";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";

type AddHandleNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "AddHandle"
>;

type AddHandleRouteProp = RouteProp<HandlesStackParamList, "AddHandle">;

interface Props {
  navigation: AddHandleNavigationProp;
  route: AddHandleRouteProp;
}

type AddHandleError = "handleExists" | null;

export default function ({ navigation, route }: Props) {
  const [handle, setHandle] = useState(route.params?.initialHandle || "");
  const [error, setError] = useState<AddHandleError>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { handles, createHandle } = useStore();

  const isValidSLabel = (label: string): boolean => {
    if (!label || label.length > 62) {
      return false;
    }
    let verifyRange = label;
    if (label.startsWith("xn--") && label.length > "xn--".length) {
      verifyRange = label.slice("xn--".length);
    }
    if (verifyRange[0] === "-" || verifyRange[verifyRange.length - 1] === "-") {
      return false;
    }
    let prev = "";
    for (const c of verifyRange) {
      if (c === "-" && prev === "-") {
        return false;
      }
      if (!/^[a-z0-9-]$/.test(c)) {
        return false;
      }
      prev = c;
    }
    return true;
  };

  const isValidHandle = (handle: string): boolean => {
    const [l, r] = handle.split("@");
    return isValidSLabel(l) && isValidSLabel(r || "");
  };

  const canAdd = handles !== null && !isLoading && isValidHandle(handle);

  const getMessage = (error: AddHandleError): string => {
    switch (error) {
      case "handleExists":
        return "This handle already exists in your keystore.";
      default:
        return "";
    }
  };

  const addHandle = async () => {
    if (!canAdd) return;
    setError(null);
    if (handle in handles) {
      setError("handleExists");
      return;
    }
    setIsLoading(true);
    try {
      await createHandle(handle);
      navigation.replace("ShowHandle", { handle });
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };
  return (
    <Layout
      footer={
        <Button
          text={isLoading ? "Adding..." : "Add Handle"}
          onPress={addHandle}
          type="main"
          disabled={!canAdd}
        />
      }
    >
      <Header
        headText="Add"
        tailText="Handle"
        subText="Enter a handle name to generate the pubkey for it."
      />
      <TextInput
        value={handle}
        onChangeText={(text) => {
          setHandle(text.trim().toLowerCase());
          setError(null);
        }}
        placeholder="me@bitcoin"
        placeholderTextColor="#4A4A4A"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
      />
      {error && <Message message={getMessage(error)} type="error" />}
    </Layout>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "monospace",
    // @ts-ignore - web-only style to remove focus outline
    outlineStyle: "none",
  } as any,
});
