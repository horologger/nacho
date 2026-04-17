import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useStore } from "@/Store";
import { validateMnemonic, xprvFromMnemonic } from "@/keys";
import { OnboardingStackParamList } from "@/Navigation";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { Layout } from "@/ui/Layout";
import { Message } from "@/ui/Message";

type Props = NativeStackScreenProps<
  OnboardingStackParamList,
  "RestoreMnemonic"
>;

export default function ({ navigation }: Props) {
  const { setupKeystore } = useStore();
  const [inputWords, setInputWords] = useState<string[]>(Array(12).fill(""));
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>(Array(12).fill(null));

  const handleWordChange = (index: number, value: string) => {
    const parts = value.trim().toLowerCase().split(/\s+/);
    if (parts.length > 1) {
      const newWords = Array(12).fill("");
      for (let i = 0; i < Math.min(parts.length, 12); i++) {
        newWords[i] = parts[i];
      }
      setInputWords(newWords);
    } else {
      const newWords = [...inputWords];
      newWords[index] = parts[0] ?? "";
      setInputWords(newWords);
    }

    if (error) {
      setError(null);
    }
  };

  const handleRestore = () => {
    setError(null);

    const mnemonic = inputWords.join(" ");
    if (!validateMnemonic(mnemonic)) {
      setError(
        "The entered seed phrase is not valid. Please check your words.",
      );
      return;
    }

    const xprv = xprvFromMnemonic(mnemonic);
    setupKeystore(xprv, {});
  };

  const isComplete = inputWords.every((word) => word.length > 0);

  return (
    <Layout
      footer={
        <Button
          text="Restore Keystore"
          onPress={handleRestore}
          type="main"
          disabled={!isComplete}
        />
      }
    >
      <Header
        headText="Restore From"
        tailText="Seed Phrase"
        subText="Enter your 12-word seed phrase to restore your keystore."
      />

      <View style={styles.inputContainer}>
        {inputWords.map((word, index) => (
          <TouchableOpacity
            key={index}
            style={styles.wordInputContainer}
            onPress={() => inputRefs.current[index]?.focus()}
          >
            <Text style={styles.wordInputNumber}>{index + 1}.</Text>
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.wordInput}
              value={word}
              onChangeText={(value) => handleWordChange(index, value)}
              placeholder=""
              placeholderTextColor="#4A4A4A"
              selectionColor="#FFFFFF"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          </TouchableOpacity>
        ))}
      </View>

      {error && <Message message={error} type="error" />}
    </Layout>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 30,
  },
  wordInputContainer: {
    width: "48%",
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  wordInputNumber: {
    fontSize: 14,
    color: "#FF7B00",
    fontWeight: "500",
  },
  wordInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: "#FFFFFF",
    padding: 0,
    margin: 0,
    textAlign: "left",
    minWidth: 0,
    // @ts-ignore - web-only style to remove focus outline
    outlineStyle: "none",
  } as any,
});
