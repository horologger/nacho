import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { HandleData, useStore } from "@/Store";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";
import { fetchProposedHandles, fetchHandlesStatuses, type HandleStatus } from "@/api";
import { save } from "@/file";

type ListHandlesRouteProp = RouteProp<HandlesStackParamList, "ListHandles">;
type ListHandlesNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ListHandles"
>;

interface Props {
  route: ListHandlesRouteProp;
  navigation: ListHandlesNavigationProp;
}

export default function ListHandles({ route, navigation }: Props) {
  const { network } = route.params;
  const { handles, getXprv } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [proposedHandles, setProposedHandles] = useState<string[]>([]);
  const [proposedState, setProposedState] = useState<"available" | "taken">("available");
  const [handleStatuses, setHandleStatuses] = useState<
    Partial<Record<string, HandleStatus>>
  >({});
  const clearSearchOnNextFocus = useRef(false);
  const mySpacesRefetchRef = useRef<() => void>(() => {});

  const refreshAllHandleStatuses = useCallback(async () => {
    const names = Object.keys(handles?.[network] ?? {});
    if (names.length === 0) {
      setHandleStatuses({});
      return null;
    }
    const list = await fetchHandlesStatuses(network, names);
    if (list.length > 0) {
      setHandleStatuses(
        list.reduce<Partial<Record<string, HandleStatus>>>((acc, s) => {
          acc[s.handle] = s;
          return acc;
        }, {}),
      );
    }
    return list;
  }, [network, handles]);

  useFocusEffect(
    useCallback(() => {
      if (clearSearchOnNextFocus.current) {
        setSearchQuery("");
        clearSearchOnNextFocus.current = false;
      }
      return () => {
        const state = navigation.getState();
        const current = state.routes[state.index];
        if (current?.name === "ShowHandle") {
          clearSearchOnNextFocus.current = true;
        }
      };
    }, [navigation]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const isPaymentPending = (s: HandleStatus) =>
        s.status === "reserved" || s.status === "processing_payment";

      const runFetch = async () => {
        const list = await refreshAllHandleStatuses();
        if (!active) {
          return;
        }
        if (list === null) {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }
        const anyPending = list.length > 0 && list.some(isPaymentPending);
        if (anyPending) {
          if (intervalId === null) {
            intervalId = setInterval(() => {
              void runFetch();
            }, 3000);
          }
        } else {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };

      mySpacesRefetchRef.current = () => {
        void runFetch();
      };

      void runFetch();

      return () => {
        active = false;
        mySpacesRefetchRef.current = () => {};
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      };
    }, [refreshAllHandleStatuses]),
  );

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery) {
        const result = await fetchProposedHandles(network, searchQuery);
        setProposedHandles(result.handles);
        setProposedState(result.state);
      } else {
        setProposedHandles([]);
        setProposedState("available");
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const exportKeystore = async () => {
    try {
      const xprv = await getXprv();
      if (!xprv) {
        throw new Error("Private key not available");
      }
      if (handles === null) {
        throw new Error("No handles to export");
      }
      const keystore = { xprv, handles };
      const fileName = `keystore_${Date.now()}.json`;
      await save(fileName, keystore);
    } catch (error) {
      throw new Error("Failed to export keystore: " + error);
    }
  };

  const handlesMap = handles?.[network] || {};
  const handlesList = Object.entries(handlesMap);
  const combinedHandles = [
    ...(searchQuery
      ? handlesList.filter(([handleName]) => handleName.includes(searchQuery))
      : handlesList),
    ...proposedHandles
      .filter((proposedHandle) => !handles || !handlesMap[proposedHandle])
      .map((handle) => [handle, null] as [string, null]),
  ];

  const renderItem = ({ item }: { item: [string, HandleData | null] }) => {
    const [handleName, handleData] = item;

    if (handleData === null) {
      return renderProposedHandle({ item: handleName });
    } else {
      return renderHandle({ item });
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

  const renderHandle = ({ item }: { item: [string, any] }) => {
    const [handleName, handleData] = item;

    const status = handleStatuses[handleName];
    const isPaymentPending =
      status &&
      (status.status === "reserved" || status.status === "processing_payment");

    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ShowHandle", { network, handle: handleName })
        }
        style={styles.handleItem}
      >
        <View style={styles.handleContent}>
          <View style={styles.handleTextCol}>
            <Text style={styles.handleName}>{renderHandleName(handleName)}</Text>
            {isPaymentPending && (
              <Text style={styles.paymentPendingText}>Payment pending</Text>
            )}
          </View>
          {handleData.path && (
            <Text style={styles.handlePath}>{handleData.path}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderProposedHandle = ({ item }: { item: string }) => {
    const isTaken = proposedState === "taken";
    return (
      <TouchableOpacity
        style={styles.proposedHandleItem}
        onPress={() =>
          navigation.navigate("AddHandle", { network, initialHandle: item })
        }
        disabled={isTaken}
      >
        <View style={styles.handleContent}>
          <Text style={styles.handleName}>{renderHandleName(item)}</Text>
          <View style={[styles.availableBadge, isTaken && styles.takenBadge]}>
            <Text style={styles.availableText}>
              {isTaken ? "Taken" : "Available"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Layout
      scrollable={false}
      footer={
        <>
          <Button
            text="Add Handle"
            onPress={() => navigation.navigate("AddHandle", { network })}
            type="main"
          />
          <Button
            text="Import Certificate"
            onPress={() =>
              navigation.navigate("ImportCertificate", { network })
            }
            type="secondary"
          />
          <Button
            text="Backup Keystore"
            onPress={exportKeystore}
            type="secondary"
          />
        </>
      }
    >
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={(text) =>
            setSearchQuery(text.toLowerCase().replace(/[^a-z0-9\-]/g, ""))
          }
          placeholder="Search handles"
          placeholderTextColor="#4A4A4A"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <TouchableWithoutFeedback
        onPress={() => {
          mySpacesRefetchRef.current();
        }}
        accessibilityRole="button"
        accessibilityLabel="Refresh My Spaces"
      >
        <View>
          <Text style={styles.mySpacesSectionLabel}>My Spaces</Text>
        </View>
      </TouchableWithoutFeedback>

      <FlatList
        data={combinedHandles}
        renderItem={renderItem}
        keyExtractor={(item) => item[0]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery === ""
                ? "Search @Bitcoin2026"
                : "Handle is taken"}
            </Text>
          </View>
        }
        style={styles.handlesList}
        showsVerticalScrollIndicator={false}
      />
    </Layout>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    marginBottom: 20,
  },
  mySpacesSectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  searchInput: {
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
  handlesList: {
    flex: 1,
  },
  handleItem: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  proposedHandleItem: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  handleContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  handleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  handleName: {
    fontSize: 18,
    fontWeight: "400",
    flex: 1,
  },
  handleSubPart: {
    color: "#FFFFFF",
  },
  handleSpacePart: {
    color: "#FF7B00",
  },
  handlePath: {
    fontSize: 14,
    color: "#D6D6D6",
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentPendingText: {
    fontSize: 14,
    color: "#FF7B00",
    marginTop: 6,
  },
  availableBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  takenBadge: {
    backgroundColor: "#EF4444",
  },
  availableText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#D6D6D6",
    fontSize: 16,
  },
});
