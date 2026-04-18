import React, { useLayoutEffect, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { HandleData, useStore } from "@/Store";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";
import { fetchProposedHandles } from "@/api";
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

    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ShowHandle", { network, handle: handleName })
        }
        style={styles.handleItem}
      >
        <View style={styles.handleContent}>
          <Text style={styles.handleName}>{renderHandleName(handleName)}</Text>
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

      <FlatList
        data={combinedHandles}
        renderItem={renderItem}
        keyExtractor={(item) => item[0]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No handles found</Text>
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
