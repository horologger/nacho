import React, { useState, useEffect } from "react";
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
    console.log("expo-iap not available (likely Expo Go)");
  }
}

export default function ShowHandle({ route, navigation }: Props) {
  const { handle } = route.params;
  const { xpub, handles, removeHandle, setHandleCertData } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [badHandleStatus, setBadHandleStatus] = useState(false);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  const handleData = handles?.[handle];

  if (!xpub || !handleData) {
    return;
  }

  const pubkey = pubFromPath(xpub, handleData.path);
  const script_pubkey = p2trScriptFromPub(pubkey);

  const { requestPurchase, fetchProducts } = (() => {
    if (!useIAP) {
      return {
        requestPurchase: async () => {
          setTimeout(() => {
            setError("IAP is mobile only");
          }, 1000);
        },
        fetchProducts: async () => {
          return [];
        },
      };
    }

    return useIAP({
      onPurchaseSuccess: async (purchase) => {
        setIsProcessingPurchase(false);
        if (!purchase.purchaseToken) {
          setError("No purchase token received");
          return;
        }
        const result = await claimHandleGoogleIAP(
          handle,
          script_pubkey,
          purchase.purchaseToken,
        );
        if (result.error) {
          setError(result.error);
        } else {
          await applyHandleStatus(result.handle_status);
        }
      },
      onPurchaseError: (error) => {
        setIsProcessingPurchase(false);
        if (error.code !== "user-cancelled") {
          setError("Purchase failed: " + error.message);
        }
      },
    });
  })();

  useEffect(() => {
    fetchAndUpdateCert();
  }, [handle]);

  const fetchAndUpdateCert = async () => {
    const status = await fetchHandleStatus(handle);
    await applyHandleStatus(status);
  };

  const applyHandleStatus = async (status: HandleStatus) => {
    switch (status.status) {
      case "invalid":
        setBadHandleStatus(true);
        setError("Handle is invalid.");
        break;
      case "pending_payment":
        if (status.script_pubkey !== script_pubkey) {
          setError("Handle is currently reserved.");
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
            setBadHandleStatus(true);
            setError(
              "Handle certificate found but script_pubkey doesn't match. This handle may belong to a different key.",
            );
          }
        }
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
      await fetchProducts({
        skus: [result.product_id],
        type: "in-app",
      });
      await requestPurchase({
        request: {
          ios: { sku: result.product_id },
          android: { skus: [result.product_id] },
        },
        type: "in-app",
      });
    } catch (error) {
      setError(
        "Failed purchase: " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      setIsProcessingPurchase(false);
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
            {(!handleData.cert || badHandleStatus) && (
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
