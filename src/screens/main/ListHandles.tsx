import React, { useLayoutEffect, useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { save } from "@/file";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HandlesStackParamList } from "@/Navigation";
import { HandleData, useStore } from "@/Store";
import { Layout } from "@/ui/Layout";
import { Button } from "@/ui/Button";

type ListHandlesNavigationProp = NativeStackNavigationProp<
  HandlesStackParamList,
  "ListHandles"
>;

interface Props {
  navigation: ListHandlesNavigationProp;
}

export default function ListHandles({ navigation }: Props) {
  const { xpub, handles } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [proposedHandles, setProposedHandles] = useState<string[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      setSearchQuery("");
      setProposedHandles([]);
    }, []),
  );

  const fetchProposedHandles = async (query: string): Promise<string[]> => {
    try {
      const response = await fetch(
        "https://testnet.atbitcoin.com/api/proposed",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ handle: query }),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
      const data = await response.json();
      return data.available_subspaces || [];
    } catch (error) {
      console.error("Failed to fetch proposed handlers:", error);
      return [];
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchQuery) {
        const results = await fetchProposedHandles(searchQuery);
        setProposedHandles(results);
      } else {
        setProposedHandles([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useLayoutEffect(() => {
    const exportKeystore = async () => {
      try {
        const keystoreData = { xpub, handles };
        const fileName = `keystore_${Date.now()}.json`;
        await save(fileName, keystoreData);
      } catch (error) {
        throw new Error("Failed to export keystore: " + error);
      }
    };

    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={exportKeystore} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Backup</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, xpub, handles]);

  const handlesList = handles ? Object.entries(handles) : [];
  const combinedHandles = [
    ...proposedHandles
      .filter((proposedHandle) => !handles || !handles[proposedHandle])
      .map((handle) => [handle, null] as [string, null]),
    ...(searchQuery
      ? handlesList.filter(([handleName]) => handleName.includes(searchQuery))
      : handlesList),
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
          navigation.navigate("ShowHandle", { handle: handleName })
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
    return (
      <TouchableOpacity
        style={styles.proposedHandleItem}
        onPress={() =>
          navigation.navigate("AddHandle", { initialHandle: item })
        }
      >
        <View style={styles.handleContent}>
          <Text style={styles.handleName}>{renderHandleName(item)}</Text>
          <View style={styles.availableBadge}>
            <Text style={styles.availableText}>Available</Text>
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
            onPress={() => navigation.navigate("AddHandle", {})}
            type="main"
          />
          <Button
            text="Import Certificate"
            onPress={() => navigation.navigate("ImportCertificate")}
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
  headerButton: {
    paddingRight: 16,
  },
  headerButtonText: {
    color: "#FF7B00",
    fontSize: 16,
    fontWeight: "400",
  },
});
