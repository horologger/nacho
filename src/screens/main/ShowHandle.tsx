import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import { pubFromPath, p2trScriptFromPub } from "@/keys";
import { buildCert } from "@/cert";
import { save } from "@/file";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";

type ShowHandleRouteProp = RouteProp<HandlesStackParamList, "ShowHandle">;
type ShowHandleNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ShowHandle"
>;

interface Props {
  route: ShowHandleRouteProp;
  navigation: ShowHandleNavigationProp;
}

export default function ShowHandle({ route, navigation }: Props) {
  const { handle } = route.params;
  const { xpub, handles, removeHandle } = useStore();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleData = handles?.[handle];

  if (!xpub || !handleData) {
    return (
      <Layout>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Handle not found</Text>
        </View>
      </Layout>
    );
  }

  const pubkey = pubFromPath(xpub, handleData.path);
  const script_pubkey = p2trScriptFromPub(pubkey);

  const handleRemoveHandle = () => {
    removeHandle(handle);
    setShowRemoveConfirm(false);
    navigation.replace("ListHandles");
  };

  const handleDownloadCertificate = async () => {
    const certData = handleData.cert;
    if (!certData) {
      return;
    }

    await save(
      `${handle}.cert.json`,
      buildCert(certData, handle, script_pubkey),
    );
  };

  const handleDownloadRequest = async () => {
    await save(`${handle}.req.json`, {
      handle: handle,
      script_pubkey,
    });
  };

  const renderHandleName = (name: string) => {
    const parts = name.split("@");
    if (parts.length === 2) {
      return (
        <>
          <Text style={styles.handleSubPart}>{parts[0]}</Text>
          <Text style={styles.handleSpacePart}>@{parts[1]}</Text>
        </>
      );
    }
    return <Text style={styles.handleSpacePart}>{name}</Text>;
  };

  return (
    <Layout
      overlay={showRemoveConfirm}
      footer={
        handleData.cert ? (
          <>
            <Button
              text="Sign Nostr Event"
              onPress={() => navigation.navigate("SignNostrEvent", { handle })}
              type="main"
            />
            <Button
              text="Download Certificate"
              onPress={handleDownloadCertificate}
              type="secondary"
            />
          </>
        ) : (
          <>
            {!showRemoveConfirm ? (
              <>
                <Button
                  text="Download Request"
                  onPress={handleDownloadRequest}
                  type="main"
                />
                <Button
                  text="Remove Handle"
                  onPress={() => setShowRemoveConfirm(true)}
                  type="danger"
                />
              </>
            ) : (
              <View style={styles.confirmSection}>
                <Header
                  headText="Remove"
                  tailText="Handle?"
                  subText="Are you sure you want to remove this handle?"
                />
                <View style={styles.confirmButtons}>
                  <Button
                    text="Remove Handle"
                    onPress={handleRemoveHandle}
                    type="danger"
                  />
                  <Button
                    text="Cancel"
                    onPress={() => setShowRemoveConfirm(false)}
                    type="secondary"
                  />
                </View>
              </View>
            )}
          </>
        )
      }
    >
      <Text style={styles.title}>{renderHandleName(handle)}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Public Key</Text>
        <Text style={styles.value} numberOfLines={6}>
          {pubkey}
        </Text>
      </View>

      {handleData.cert && (
        <View style={styles.section}>
          <Text style={styles.label}>Proof</Text>
          <Text style={styles.value} numberOfLines={10}>
            {handleData.cert.witness.data}
          </Text>
        </View>
      )}
    </Layout>
  );
}

const styles = StyleSheet.create({
  notFoundContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notFoundText: {
    fontSize: 18,
    color: "#D6D6D6",
  },
  title: {
    fontSize: 28,
    fontWeight: "400",
    marginBottom: 32,
    textAlign: "center",
  },
  handleSubPart: {
    color: "#FFFFFF",
  },
  handleSpacePart: {
    color: "#FF7B00",
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: "400",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  value: {
    fontSize: 14,
    color: "#FFFFFF",
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
    fontFamily: "monospace",
    lineHeight: 20,
  },
  confirmSection: {
    backgroundColor: "#1A1A1A",
    padding: 20,
    borderRadius: 12,
    marginTop: 12,
  },
  confirmButtons: {
    flexDirection: "column",
    gap: 0,
  },
});
