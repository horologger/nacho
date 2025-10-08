import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { open } from "@/file";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import {
  isNostrEventData,
  NostrEvent,
  NostrEventData,
  signNostrEvent,
} from "@/nostr";
import { useStore } from "@/Store";
import { prvFromPath } from "@/keys";
import { save } from "@/file";

type Props = NativeStackScreenProps<HandlesStackParamList, "SignNostrEvent">;

export default function SignNostrEvent({ navigation, route }: Props) {
  const { handle } = route.params;
  const { handles, getXprv } = useStore();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [nostrEvent, setNostrEvent] = useState<NostrEventData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);

  const selectFile = async () => {
    setValidationError(null);
    setNostrEvent(null);
    setSelectedFileName(null);

    try {
      const { data, filename } = await open();

      if (isNostrEventData(data)) {
        setNostrEvent(data);
        setSelectedFileName(filename);
        setValidationError(null);
      } else {
        setValidationError("Invalid nostr event format in file");
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "File selection canceled") {
          return;
        }
        setValidationError(error.message);
      } else {
        setValidationError("Failed to process file");
      }
    }
  };

  const handleSignEvent = async () => {
    if (!nostrEvent || !handles) return;

    try {
      setIsSigningInProgress(true);
      setValidationError(null);

      const handleData = handles[handle];
      if (!handleData) {
        throw new Error(`Handle ${handle} not found`);
      }

      const xprv = await getXprv();
      if (!xprv) {
        throw new Error("No extended private key available");
      }

      const privateKey = prvFromPath(xprv, handleData.path);
      const signedEvent = await signNostrEvent(nostrEvent, privateKey);

      const signedFileName = selectedFileName
        ? selectedFileName.replace(".json", "_signed.json")
        : "signed_nostr_event.json";

      await save(signedFileName, signedEvent);

      navigation.goBack();
    } catch (error) {
      console.error("Error signing nostr event:", error);
      setValidationError(
        error instanceof Error ? error.message : "Failed to sign nostr event",
      );
    } finally {
      setIsSigningInProgress(false);
    }
  };

  const renderFileInfo = () => {
    if (!selectedFileName) return null;

    return (
      <View style={styles.fileInfoContainer}>
        <Text style={styles.fileInfoTitle}>Selected File</Text>
        <Text style={styles.fileName}>{selectedFileName}</Text>
      </View>
    );
  };

  return (
    <Layout
      footer={
        <Button
          text={isSigningInProgress ? "Signing..." : "Sign Event"}
          onPress={handleSignEvent}
          type="main"
          disabled={!nostrEvent || isSigningInProgress}
        />
      }
    >
      <Header
        headText="Sign"
        tailText="Nostr Event"
        subText={`Select a JSON nostr event file to sign with handle: ${handle}`}
      />

      <View style={styles.fileSelectionContainer}>
        <Button text="Select JSON File" onPress={selectFile} type="secondary" />

        {renderFileInfo()}
      </View>

      {validationError !== null && (
        <Message message={validationError} type="error" />
      )}
      {nostrEvent && !validationError && (
        <Message
          message="Nostr event file validated successfully. Ready to sign."
          type="success"
        />
      )}
    </Layout>
  );
}

const styles = StyleSheet.create({
  fileSelectionContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  fileInfoContainer: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  fileInfoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF7B00",
    marginBottom: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "400",
    color: "#FFFFFF",
  },
});
