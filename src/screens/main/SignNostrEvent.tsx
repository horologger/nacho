import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { open } from "@/file";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import {
  broadcastNostrEventToRelay,
  isNostrEvent,
  isNostrEventData,
  NostrEventData,
  signNostrEvent,
} from "@/nostr";
import { useStore } from "@/Store";
import { prvFromPath } from "@/keys";
import { save } from "@/file";

const HELLO_WORLD_SOURCE_FILENAME = "hello_world_event.json";

type Props = NativeStackScreenProps<HandlesStackParamList, "SignNostrEvent">;

export default function SignNostrEvent({ navigation, route }: Props) {
  const { network, handle } = route.params;
  const { handles, getXprv } = useStore();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [nostrEvent, setNostrEvent] = useState<NostrEventData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);
  const [signedEventJson, setSignedEventJson] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [relayNotice, setRelayNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const useHelloWorldEvent = () => {
    setValidationError(null);
    setRelayNotice(null);
    setSignedEventJson(null);
    setNostrEvent({
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: "Hello World!",
    });
    setSelectedFileName(HELLO_WORLD_SOURCE_FILENAME);
  };

  const selectFile = async () => {
    setValidationError(null);
    setRelayNotice(null);
    setSignedEventJson(null);
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

      const handleData = handles?.[network]?.[handle];
      if (!handleData) {
        throw new Error(`Handle ${handle} not found`);
      }

      const xprv = await getXprv();
      if (!xprv) {
        throw new Error("No extended private key available");
      }

      const privateKey = prvFromPath(xprv, handleData.path);
      const signedEvent = await signNostrEvent(nostrEvent, privateKey);

      if (selectedFileName === HELLO_WORLD_SOURCE_FILENAME) {
        setSignedEventJson(JSON.stringify(signedEvent, null, 2));
        return;
      }

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

  const renderSourceDetails = () => {
    if (!selectedFileName || !nostrEvent) return null;

    if (selectedFileName === HELLO_WORLD_SOURCE_FILENAME) {
      return (
        <View style={styles.fileInfoContainer}>
          <Text style={styles.fileInfoTitle}>Message</Text>
          <TextInput
            value={nostrEvent.content}
            onChangeText={(content) =>
              setNostrEvent((prev) => (prev ? { ...prev, content } : null))
            }
            multiline
            style={styles.messageInput}
            placeholder="Hello World!"
            placeholderTextColor="#888888"
            textAlignVertical="top"
          />
        </View>
      );
    }

    return (
      <View style={styles.fileInfoContainer}>
        <Text style={styles.fileInfoTitle}>Selected File</Text>
        <Text style={styles.fileName}>{selectedFileName}</Text>
      </View>
    );
  };

  const copySignedJson = async () => {
    if (!signedEventJson) return;
    await Clipboard.setStringAsync(signedEventJson);
  };

  const broadcastToPrimal = async () => {
    if (!signedEventJson) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(signedEventJson);
    } catch {
      setRelayNotice({
        type: "error",
        text: "Could not parse signed event JSON.",
      });
      return;
    }
    if (!isNostrEvent(parsed)) {
      setRelayNotice({
        type: "error",
        text: "Signed payload is not a valid Nostr event.",
      });
      return;
    }

    try {
      setIsBroadcasting(true);
      setRelayNotice(null);
      await broadcastNostrEventToRelay(parsed);
      setRelayNotice({
        type: "success",
        text: "Event sent to Primal relay (wss://relay.primal.net/).",
      });
    } catch (error) {
      setRelayNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to broadcast to Primal",
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const footerButtonDisabled =
    !nostrEvent || isSigningInProgress || signedEventJson !== null;

  return (
    <Layout
      footer={
        signedEventJson !== null ? (
          <Button text="Done" onPress={() => navigation.goBack()} type="main" />
        ) : (
          <Button
            text={isSigningInProgress ? "Signing..." : "Sign Event"}
            onPress={handleSignEvent}
            type="main"
            disabled={footerButtonDisabled}
          />
        )
      }
    >
      <Header
        headText="Sign"
        tailText="Nostr Event"
        subText={`Select a JSON nostr event file to sign with handle: ${handle}`}
      />

      <View style={styles.fileSelectionContainer}>
        <Button text="Select JSON File" onPress={selectFile} type="secondary" />
        <Button
          text="Use Hello World Event"
          onPress={useHelloWorldEvent}
          type="main"
        />

        {renderSourceDetails()}
      </View>

      {validationError !== null && (
        <Message message={validationError} type="error" />
      )}
      {signedEventJson !== null && (
        <View style={styles.signedOutputSection}>
          <Text style={styles.signedOutputTitle}>Signed event</Text>
          <Text style={styles.signedOutputHint}>
            Select the text below or use Copy.
          </Text>
          <TextInput
            value={signedEventJson}
            multiline
            editable={false}
            selectTextOnFocus
            style={styles.signedJsonInput}
            textAlignVertical="top"
          />
          <Button
            text="Copy to clipboard"
            onPress={copySignedJson}
            type="secondary"
          />
          <View style={styles.broadcastButtonWrap}>
            <Button
              text={
                isBroadcasting
                  ? "Broadcasting..."
                  : "Broadcast to Primal"
              }
              onPress={broadcastToPrimal}
              type="main"
              disabled={isBroadcasting}
            />
          </View>
          {relayNotice !== null && (
            <Message
              message={relayNotice.text}
              type={relayNotice.type === "success" ? "success" : "error"}
            />
          )}
        </View>
      )}
      {nostrEvent && !validationError && signedEventJson === null && (
        <Message
          message={
            selectedFileName === HELLO_WORLD_SOURCE_FILENAME
              ? "Message ready to sign."
              : "Nostr event file validated successfully. Ready to sign."
          }
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
  messageInput: {
    minHeight: 100,
    maxHeight: 220,
    backgroundColor: "#0D0D0D",
    color: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    lineHeight: 22,
    // @ts-ignore - web word wrap
    wordBreak: "break-word",
    overflowWrap: "break-word",
  } as any,
  signedOutputSection: {
    marginTop: 8,
  },
  signedOutputTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF7B00",
    marginBottom: 6,
  },
  signedOutputHint: {
    fontSize: 13,
    color: "#CCCCCC",
    marginBottom: 10,
  },
  broadcastButtonWrap: {
    marginTop: 8,
  },
  signedJsonInput: {
    minHeight: 200,
    maxHeight: 360,
    backgroundColor: "#1A1A1A",
    color: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
  },
});
