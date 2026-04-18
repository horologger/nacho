import React, { useState, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Linking,
  Pressable,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { useStore } from "@/Store";
import {
  p2trScriptFromPub,
  p2trAddressFromPub,
  npubFromXOnlyPubHex,
  nsecFromPrvHex,
  prvFromPath,
} from "@/keys";
import { buildCert } from "@/cert";
import { save } from "@/file";
import { Layout } from "@/ui/Layout";
import { Header } from "@/ui/Header";
import { Button } from "@/ui/Button";
import { Message } from "@/ui/Message";
import {
  fetchHandleStatus,
  sendHandleAddRequest,
  fetchHandleCertificateJson,
  reserveHandle,
  claimHandleIAP,
  HandleStatus,
} from "@/api";
import { Cert, extractCertData, isCert } from "@/cert";

type ShowHandleRouteProp = RouteProp<HandlesStackParamList, "ShowHandle">;
type ShowHandleNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ShowHandle"
>;

interface Props {
  route: ShowHandleRouteProp;
  navigation: ShowHandleNavigationProp;
}

type IAPHook = (typeof import("expo-iap"))["useIAP"];
const iap = (() => {
  switch (Platform.OS) {
    case "android":
    case "ios":
      try {
        const hook = require("expo-iap").useIAP as IAPHook;
        return {
          platform:
            Platform.OS === "android"
              ? ("google_iap" as const)
              : ("apple_iap" as const),
          hook,
        };
      } catch (error) {
        console.error("expo-iap not available");
        return null;
      }
    default:
      return null;
  }
})();

export default function ShowHandle({ route, navigation }: Props) {
  const { network, handle } = route.params;
  const { xpub, handles, removeHandle, setHandleCertData, getXprv } =
    useStore();
  const [error, setError] = useState<string | null>(null);
  const [handleStatusString, setHandleStatusString] = useState<
    HandleStatus["status"] | null
  >(null);
  const [isScriptPubkeyValid, setIsScriptPubkeyValid] = useState<
    boolean | null
  >(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isReceivingCertificate, setIsReceivingCertificate] = useState(false);
  const [sendRequestFlash, setSendRequestFlash] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const sendRequestFlashTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nostrKeyView, setNostrKeyView] = useState<"pubkey" | "nsec">(
    "pubkey",
  );
  const [cachedNsec, setCachedNsec] = useState<string | null>(null);
  const [nostrNsecLoading, setNostrNsecLoading] = useState(false);

  const handleData = handles?.[network]?.[handle];

  if (!xpub || !handleData) {
    navigation.replace("ListHandles", { network });
    return null;
  }

  const pubkey = handleData.pubkey;
  const script_pubkey = p2trScriptFromPub(pubkey);
  const nostrNpub = npubFromXOnlyPubHex(pubkey);
  const primalProfileUrl = `https://primal.net/p/${nostrNpub}`;

  const handleNostrLabelPress = async () => {
    if (nostrKeyView === "nsec") {
      setNostrKeyView("pubkey");
      return;
    }

    setNostrKeyView("nsec");

    if (cachedNsec !== null) return;

    try {
      setNostrNsecLoading(true);
      const xprv = await getXprv();
      if (!xprv) {
        throw new Error("No extended private key available");
      }
      const prvHex = prvFromPath(xprv, handleData.path);
      setCachedNsec(nsecFromPrvHex(prvHex));
    } catch (e) {
      setNostrKeyView("pubkey");
      setError(
        e instanceof Error ? e.message : "Could not load Nostr secret key",
      );
    } finally {
      setNostrNsecLoading(false);
    }
  };

  const { requestPurchase, finishTransaction } =
    iap && network === "mainnet"
      ? iap.hook({
          onPurchaseSuccess: async (purchase) => {
            if (!purchase.purchaseToken) {
              setError("No purchase token received");
              return;
            }
            const result = await claimHandleIAP(
              network,
              handle,
              script_pubkey,
              purchase.purchaseToken,
              iap.platform,
            );
            if (result.error) {
              setError(result.error);
              fetchAndUpdateHandleStatus();
            } else {
              await applyHandleStatus(result.handle_status);
              if (result.handle_status.status === "taken") {
                await finishTransaction({
                  purchase,
                  isConsumable: true,
                });
              }
            }
          },
          onPurchaseError: (error) => {
            if (error.code !== "user-cancelled") {
              setError("Purchase failed: " + error.message);
            }
          },
        })
      : ({
          requestPurchase: async () => {
            const result = await claimHandleIAP(
              network,
              handle,
              script_pubkey,
              `test_valid_purchase_${Date.now().toString()}${Math.random().toString(36).slice(1)}`,
              "test",
            );
            if (result.error) {
              setError(result.error);
              fetchAndUpdateHandleStatus();
            } else {
              await applyHandleStatus(result.handle_status);
            }
            return null;
          },
          finishTransaction: async () => {},
        } as Pick<
          ReturnType<IAPHook>,
          "requestPurchase" | "finishTransaction"
        >);

  useFocusEffect(
    React.useCallback(() => {
      fetchAndUpdateHandleStatus();
    }, []),
  );

  useEffect(() => {
    if (
      handleStatusString === "reserved" ||
      handleStatusString === "processing_payment"
    ) {
      const interval = setInterval(() => {
        fetchAndUpdateHandleStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [handleStatusString]);

  useEffect(() => {
    return () => {
      if (sendRequestFlashTimeoutRef.current !== null) {
        clearTimeout(sendRequestFlashTimeoutRef.current);
      }
    };
  }, []);

  const fetchAndUpdateHandleStatus = async () => {
    const status = await fetchHandleStatus(network, handle);
    await applyHandleStatus(status);
  };

  const applyHandleStatus = async (status: HandleStatus) => {
    setHandleStatusString(status.status);
    if ("script_pubkey" in status) {
      if (status.script_pubkey === script_pubkey) {
        setIsScriptPubkeyValid(true);
        if ("certificate" in status) {
          const certData = extractCertData(status.certificate);
          await setHandleCertData(network, handle, certData);
        }
      } else {
        setIsScriptPubkeyValid(false);
      }
    } else {
      setIsScriptPubkeyValid(null);
    }
  };

  const handleRemoveHandle = () => {
    removeHandle(network, handle);
    navigation.replace("ListHandles", { network });
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

  const flashSendRequestMessage = (text: string, type: "success" | "error") => {
    if (sendRequestFlashTimeoutRef.current !== null) {
      clearTimeout(sendRequestFlashTimeoutRef.current);
    }
    setSendRequestFlash({ text, type });
    sendRequestFlashTimeoutRef.current = setTimeout(() => {
      setSendRequestFlash(null);
      sendRequestFlashTimeoutRef.current = null;
    }, 3500);
  };

  const handleSendRequest = async () => {
    setError(null);
    setIsSendingRequest(true);
    const result = await sendHandleAddRequest(network, handle, script_pubkey);
    setIsSendingRequest(false);
    if (!result.ok) {
      flashSendRequestMessage(result.error, "error");
      return;
    }
    flashSendRequestMessage("Request sent successfully.", "success");
    await fetchAndUpdateHandleStatus();
  };

  const handleReceiveCertificate = async () => {
    setError(null);
    setIsReceivingCertificate(true);
    const result = await fetchHandleCertificateJson(network, handle);
    setIsReceivingCertificate(false);
    if (!result.ok) {
      if (result.status === 404) {
        flashSendRequestMessage(
          "Certificate has not been generated yet.  Please try again later.",
          "error",
        );
      } else {
        setError(result.error);
      }
      return;
    }
    const data = result.data;
    if (!isCert(data)) {
      setError("Invalid certificate format");
      return;
    }
    const cert: Cert = data;
    const certData = extractCertData(cert);
    const hd = handles?.[network]?.[cert.handle];
    if (
      hd === undefined ||
      xpub === null ||
      p2trScriptFromPub(hd.pubkey) !== cert.script_pubkey ||
      cert.handle !== handle
    ) {
      setError("Certificate does not match this handle");
      return;
    }
    await setHandleCertData(network, handle, certData);
    await fetchAndUpdateHandleStatus();
  };

  const handleBuyHandle = async () => {
    setError(null);
    setHandleStatusString("reserved");
    const result = await reserveHandle(network, handle, script_pubkey);
    if ("error" in result) {
      setError(result.error);
      fetchAndUpdateHandleStatus();
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
      setError(
        "Failed purchase: " +
          (error instanceof Error ? error.message : String(error)),
      );
      fetchAndUpdateHandleStatus();
    }
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
          (handleStatusString !== null || handleData.cert) && (
            <>
              {(() => {
                if (handleData.cert) {
                  return (
                    <>
                      <Button
                        text="Sign Nostr Event"
                        onPress={() =>
                          navigation.navigate("SignNostrEvent", {
                            network,
                            handle,
                          })
                        }
                        type="main"
                      />
                      <Button
                        text="Download Certificate"
                        onPress={handleDownloadCertificate}
                        type="secondary"
                      />
                    </>
                  );
                }

                if (handleStatusString === "unknown") {
                  return (
                    <>
                      <Button
                        text={
                          isSendingRequest ? "Sending..." : "Send Request"
                        }
                        onPress={handleSendRequest}
                        type="main"
                        disabled={isSendingRequest || isReceivingCertificate}
                      />
                      <Button
                        text={
                          isReceivingCertificate
                            ? "Loading..."
                            : "Receive Certificate"
                        }
                        onPress={handleReceiveCertificate}
                        type="main"
                        disabled={isSendingRequest || isReceivingCertificate}
                      />
                      <Button
                        text="Download Request"
                        onPress={handleDownloadRequest}
                        type="main"
                      />
                    </>
                  );
                }

                const isProcessingPurchase =
                  isScriptPubkeyValid === true &&
                  (handleStatusString === "reserved" ||
                    handleStatusString === "processing_payment");

                return (
                  <>
                    {(isProcessingPurchase ||
                      handleStatusString === "available") && (
                      <Button
                        text={
                          isProcessingPurchase
                            ? "Processing..."
                            : network === "testnet4"
                              ? "Claim Handle"
                              : "Buy Handle"
                        }
                        onPress={handleBuyHandle}
                        type="main"
                        disabled={isProcessingPurchase}
                      />
                    )}
                    {handleStatusString === "available" && (
                      <>
                        <Button
                          text={
                            isSendingRequest ? "Sending..." : "Send Request"
                          }
                          onPress={handleSendRequest}
                          type="main"
                          disabled={isSendingRequest || isReceivingCertificate}
                        />
                        <Button
                          text={
                            isReceivingCertificate
                              ? "Loading..."
                              : "Receive Certificate"
                          }
                          onPress={handleReceiveCertificate}
                          type="main"
                          disabled={isSendingRequest || isReceivingCertificate}
                        />
                        <Button
                          text="Download Request"
                          onPress={handleDownloadRequest}
                          type="main"
                        />
                      </>
                    )}
                  </>
                );
              })()}
              {(isScriptPubkeyValid === false ||
                handleStatusString === "available" ||
                handleStatusString === "preallocated" ||
                handleStatusString === "invalid" ||
                handleStatusString === "unknown") && (
                <Button
                  text="Remove Handle"
                  onPress={() => setShowRemoveConfirm(true)}
                  type="danger"
                />
              )}
            </>
          )
        )
      }
    >
      <Text style={styles.title}>
        {(() => {
          const parts = handle.split("@");
          if (parts.length === 2) {
            return (
              <>
                <Text style={styles.handleSubPart}>{parts[0]}</Text>
                <Text style={styles.handleSpacePart}>@{parts[1]}</Text>
              </>
            );
          }
          return <Text style={styles.handleSpacePart}>{handle}</Text>;
        })()}
      </Text>

      {sendRequestFlash && (
        <Message message={sendRequestFlash.text} type={sendRequestFlash.type} />
      )}

      {(() => {
        if (error) {
          return <Message message={error} type="error" />;
        }

        if (isScriptPubkeyValid === false) {
          const message =
            handleStatusString === "taken"
              ? "Handle is taken, but it associated with a different public key."
              : "Handle is currently reserved by another user.";
          return <Message message={message} type="error" />;
        }

        if (
          handleStatusString === "taken" &&
          isScriptPubkeyValid === true &&
          handleData.cert === undefined
        ) {
          return (
            <Message
              message="Handle successfully claimed. Certificate is being generated."
              type="success"
            />
          );
        }

        return null;
      })()}

      <View style={styles.section}>
        <Text style={styles.label}>Public Key</Text>
        <Text style={styles.value} numberOfLines={6} textBreakStrategy="simple">
          {pubkey}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Script Pubkey</Text>
        <Text style={styles.value} numberOfLines={6} textBreakStrategy="simple" selectable>
          {script_pubkey}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Taproot Address</Text>
        <Text style={styles.value} numberOfLines={6} textBreakStrategy="simple" selectable>
          {p2trAddressFromPub(pubkey, network === "mainnet")}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              nostrKeyView === "pubkey"
                ? "Show Nostr secret key"
                : "Show Nostr public key"
            }
            onPress={() => void handleNostrLabelPress()}
            android_ripple={null}
            hitSlop={8}
            style={styles.labelPressable}
          >
            <Text style={[styles.label, styles.labelInRow]}>
              {nostrKeyView === "pubkey" ? "Nostr Pubkey" : "Nostr NSEC"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open profile on Primal"
            accessibilityState={{ disabled: nostrKeyView === "nsec" }}
            onPress={() => void Linking.openURL(primalProfileUrl)}
            disabled={nostrKeyView === "nsec"}
            style={
              nostrKeyView === "nsec" ? styles.primalLinkHidden : undefined
            }
          >
            <Text style={styles.inlineLink}>On Primal</Text>
          </Pressable>
        </View>
        <Text style={styles.value} numberOfLines={6} textBreakStrategy="simple" selectable>
          {nostrKeyView === "pubkey"
            ? nostrNpub
            : nostrNsecLoading
              ? "Loading…"
              : (cachedNsec ?? "")}
        </Text>
      </View>

      {handleData.cert && (
        <View style={styles.section}>
          <Text style={styles.label}>Proof</Text>
          <Text
            style={styles.value}
            numberOfLines={10}
            textBreakStrategy="simple"
          >
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
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  labelInRow: {
    marginBottom: 0,
    flexShrink: 1,
  },
  labelPressable: {
    alignSelf: "flex-start",
    flexShrink: 1,
  },
  primalLinkHidden: {
    opacity: 0,
  },
  inlineLink: {
    fontSize: 16,
    fontWeight: "400",
    color: "#FF7B00",
    textDecorationLine: "underline",
  },
  value: {
    fontSize: 14,
    color: "#FFFFFF",
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 12,
    fontFamily: "monospace",
    lineHeight: 20,
    // @ts-ignore - web-specific styles for word breaking
    wordBreak: "break-all",
    overflowWrap: "break-word",
  } as any,
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
