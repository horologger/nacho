import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
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
import { Message } from "@/ui/Message";
import {
  fetchHandleStatus,
  reserveHandle,
  claimHandleGoogleIAP,
  HandleStatus,
} from "@/api";
import { extractCertData } from "@/cert";

type ShowHandleRouteProp = RouteProp<HandlesStackParamList, "ShowHandle">;
type ShowHandleNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ShowHandle"
>;

interface Props {
  route: ShowHandleRouteProp;
  navigation: ShowHandleNavigationProp;
}

type UseIAPHook = (typeof import("expo-iap"))["useIAP"];
let useIAP: UseIAPHook | null = null;
if (Platform.OS !== "web") {
  try {
    useIAP = require("expo-iap").useIAP;
  } catch (error) {
    console.error("expo-iap not available");
  }
}

export default function ShowHandle({ route, navigation }: Props) {
  const { handle } = route.params;
  const { xpub, handles, removeHandle, setHandleCertData } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removableHandleCert, setRemovableHandleCert] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState<
    boolean | null
  >(null);

  const handleData = handles?.[handle];

  if (!xpub || !handleData) {
    return;
  }

  const pubkey = pubFromPath(xpub, handleData.path);
  const script_pubkey = p2trScriptFromPub(pubkey);

  const claimParamsRef = useRef({ handle, script_pubkey });

  useEffect(() => {
    claimParamsRef.current = { handle, script_pubkey };
  }, [handle, script_pubkey]);

  const { requestPurchase, finishTransaction } = useIAP ? useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (!purchase.purchaseToken) {
        setError("No purchase token received");
        return;
      }
      const { handle, script_pubkey } = claimParamsRef.current;
      const result = await claimHandleGoogleIAP(
        handle,
        script_pubkey,
        purchase.purchaseToken,
      );
      if (result.error) {
        setError(result.error);
      } else {
        await applyHandleStatus(result.handle_status);
        await finishTransaction({
          purchase,
          isConsumable: true,
        });
      }
    },
    onPurchaseError: (error) => {
      if (error.code !== "user-cancelled") {
        setError("Purchase failed: " + error.message);
        setIsProcessingPurchase(null);
      }
    },
  }) : {
    requestPurchase: async () => {
      const result = await claimHandleGoogleIAP(
        handle,
        script_pubkey,
        "test_valid_purchase",
      );
      if (result.error) {
        setError(result.error);
      } else {
        await applyHandleStatus(result.handle_status);
      }
      return null;
    },
    finishTransaction: async ()=> {}
  } as Pick<ReturnType<UseIAPHook>, 'requestPurchase' | 'finishTransaction'>;

  useEffect(() => {
    fetchAndUpdateCert();
  }, [handle]);

  useEffect(() => {
    if (isProcessingPurchase === true) {
      const interval = setInterval(() => {
        fetchAndUpdateCert();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isProcessingPurchase]);

  const fetchAndUpdateCert = async () => {
    const status = await fetchHandleStatus(handle);
    await applyHandleStatus(status);
  };

  const applyHandleStatus = async (status: HandleStatus) => {
    setError(null);
    setIsProcessingPurchase(null);
    setRemovableHandleCert(false);
    switch (status.status) {
      case "available":
        setRemovableHandleCert(true);
        setIsProcessingPurchase(false);
        break;
      case "unknown":
        setRemovableHandleCert(true);
        break;
      case "invalid":
        setRemovableHandleCert(true);
        setError("Handle is invalid.");
        break;
      case "pending_payment":
        if (status.script_pubkey !== script_pubkey) {
          setRemovableHandleCert(true);
          setError("Handle is currently reserved.");
        } else {
          setIsProcessingPurchase(true);
        }
        break;
      case "taken":
        if ("script_pubkey" in status) {
          if (status.script_pubkey === script_pubkey) {
            if ("certificate" in status) {
              const certData = extractCertData(status.certificate);
              await setHandleCertData(handle, certData);
            }
          } else {
            setRemovableHandleCert(true);
            setError(
              "Handle certificate found but script_pubkey doesn't match. This handle may belong to a different key.",
            );
          }
        }
        break;
    }
  };

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

  const handleBuyHandle = async () => {
    setIsProcessingPurchase(true);
    setError(null);

    const result = await reserveHandle(handle, script_pubkey, "google_iap");
    if ("error" in result) {
      setError(result.error);
      setIsProcessingPurchase(false);
      return;
    }

    try {
      await requestPurchase({
        request: {
          ios: { sku: result.product_id },
          android: { skus: [result.product_id] },
        },
        type: "in-app",
      });
    } catch (error) {
      setIsProcessingPurchase(false);
      setError(
        "Failed purchase: " +
        (error instanceof Error ? error.message : String(error)),
      );
    }
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
        showRemoveConfirm ? (
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
        ) : (
          <>
            {handleData.cert && (
              <Button
                text="Sign Nostr Event"
                onPress={() =>
                  navigation.navigate("SignNostrEvent", { handle })
                }
                type="main"
              />
            )}
            {handleData.cert ? (
              <Button
                text="Download Certificate"
                onPress={handleDownloadCertificate}
                type="secondary"
              />
            ) : isProcessingPurchase === null ? (
              <Button
                text="Download Request"
                onPress={handleDownloadRequest}
                type="main"
              />
            ) : (
              <>
                <Button
                  text={isProcessingPurchase ? "Processing..." : "Buy Handle"}
                  onPress={handleBuyHandle}
                  type="main"
                  disabled={isProcessingPurchase}
                />
                <Button
                  text="Download Request"
                  onPress={handleDownloadRequest}
                  type="secondary"
                />
              </>
            )}
            {removableHandleCert && (
              <Button
                text="Remove Handle"
                onPress={() => setShowRemoveConfirm(true)}
                type="danger"
              />
            )}
          </>
        )
      }
    >
      <Text style={styles.title}>{renderHandleName(handle)}</Text>

      {error && <Message message={error} type="error" />}

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
