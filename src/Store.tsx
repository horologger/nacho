import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { CertData, isCertData, areCertDataEqual } from "@/cert";
import { xpubFromXprv, pubFromXprv } from "@/keys";

const getSecureStorage = () => {
  if (Platform.OS === "web") {
    return {
      async getXprv(): Promise<string | null> {
        return await AsyncStorage.getItem("xprv");
      },
      async setXprv(value: string): Promise<void> {
        await AsyncStorage.setItem("xprv", value);
      },
      async removeXprv(): Promise<void> {
        await AsyncStorage.removeItem("xprv");
      },
    };
  }

  return {
    async getXprv(): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync("xprv", {
          authenticationPrompt: "Access your private key",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to get xprv:", error);
        throw error;
      }
    },
    async setXprv(value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync("xprv", value, {
          authenticationPrompt: "Secure your private key",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to set xprv:", error);
        throw error;
      }
    },
    async removeXprv(): Promise<void> {
      await SecureStore.deleteItemAsync("xprv");
    },
  };
};

const secureStorage = getSecureStorage();

export type HandleData = {
  path: string;
  pubkey: string;
  cert?: CertData;
};

function isHandleData(obj: unknown): obj is HandleData {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const handle = obj as Record<string, unknown>;
  if (
    typeof handle.path !== "string" ||
    !/^m(?:\/(?:\d+'|\d+))+$/.test(handle.path)
  ) {
    return false;
  }
  if (typeof handle.pubkey !== "string" || !/^[0-9a-f]{64}$/.test(handle.pubkey)) {
    return false;
  }
  if (handle.cert !== undefined && !isCertData(handle.cert)) {
    return false;
  }
  return true;
}

export type Network = "testnet4" | "mainnet";

function isNetwork(s: unknown): s is Network {
  return s === "testnet4" || s === "mainnet";
}

function getDerivationPrefix(network: Network): string {
  return network === "mainnet" ? "m/86'/0'/9'/0/" : "m/86'/1'/9'/0/";
}

export type HandlesMap = Record<string, HandleData>;
export type Handles = Partial<Record<Network, HandlesMap>>;

export type Keystore = {
  xpub: string;
  handles: Handles;
};

export type KeystoreBackup = {
  xprv: string;
  handles: Handles;
};

function isHandles(obj: unknown): obj is Handles {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const handles = obj as Record<string, unknown>;
  for (const network of Object.keys(handles)) {
    if (!isNetwork(network)) {
      return false;
    }
    const handlesMap = handles[network];
    if (!handlesMap || typeof handlesMap !== "object") {
      return false;
    }
    for (const handleData of Object.values(
      handlesMap as Record<string, unknown>,
    )) {
      if (!isHandleData(handleData)) {
        return false;
      }
    }
  }
  return true;
}

export function isKeystore(obj: unknown): obj is Keystore {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const keystore = obj as Record<string, unknown>;
  if (typeof keystore.xpub !== "string") {
    return false;
  }
  return isHandles(keystore.handles);
}

export function isKeystoreBackup(obj: unknown): obj is KeystoreBackup {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const k = obj as Record<string, unknown>;
  if (typeof k.xprv !== "string") {
    return false;
  }
  return isHandles(k.handles);
}

export function isImportableKeystoreFile(
  obj: unknown,
): obj is Keystore | KeystoreBackup {
  return isKeystore(obj) || isKeystoreBackup(obj);
}

type StoreContextType = {
  xpub: string | null;
  handles: Handles | null;
  getXprv: () => Promise<string | null>;
  setupKeystore: (xprv: string, handles: Handles) => Promise<void>;
  createHandle: (network: Network, handle: string) => Promise<void>;
  removeHandle: (network: Network, handle: string) => Promise<void>;
  setHandleCertData: (
    network: Network,
    handle: string,
    cert: CertData | null,
  ) => Promise<void>;
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [xpub, setXpub] = useState<string | null>(null);
  const [handles, setHandles] = useState<Handles | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const keystoreJson = await AsyncStorage.getItem("keystore");
      if (keystoreJson) {
        const keystore = JSON.parse(keystoreJson);
        if (isKeystore(keystore)) {
          setXpub(keystore.xpub);
          setHandles(keystore.handles);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveKeystore = async (handlesToSave?: Handles, xpubToSave?: string) => {
    let xpubValue = xpub;
    if (xpubToSave !== undefined) {
      setXpub(xpubToSave);
      xpubValue = xpubToSave;
    }
    let handlesValue = handles;
    if (handlesToSave !== undefined) {
      setHandles(handlesToSave);
      handlesValue = handlesToSave;
    }

    if (xpubValue === null) {
      throw new Error("Cannot save keystore without an xpub");
    }
    if (handlesValue === null) {
      throw new Error("Cannot save keystore without handles");
    }

    const keystore: Keystore = { xpub: xpubValue, handles: handlesValue };
    await AsyncStorage.setItem("keystore", JSON.stringify(keystore));
  };

  const getXprv = async (): Promise<string | null> => {
    return await secureStorage.getXprv();
  };

  const setupKeystore = async (
    xprv: string,
    handles: Handles,
  ): Promise<void> => {
    await secureStorage.setXprv(xprv);
    await saveKeystore(handles, xpubFromXprv(xprv));
  };

  const createHandle = async (
    network: Network,
    handle: string,
  ): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot create handle without handles");
    }
    const handlesMap = handles[network] || {};
    if (handle in handlesMap) {
      return;
    }

    const prefix = getDerivationPrefix(network);

    let maxIndex = -1;
    for (const handleData of Object.values(handlesMap)) {
      if (handleData.path.startsWith(prefix)) {
        const indexStr = handleData.path.slice(prefix.length);
        const index = parseInt(indexStr, 10);
        if (
          !isNaN(index) &&
          index.toString() === indexStr &&
          index > maxIndex
        ) {
          maxIndex = index;
        }
      }
    }

    const path = prefix + (maxIndex + 1).toString();

    const xprv = await secureStorage.getXprv();
    if (!xprv) {
      throw new Error("Cannot create handle without private key");
    }
    const pubkey = pubFromXprv(xprv, path);

    await saveKeystore({
      ...handles,
      [network]: {
        ...handlesMap,
        [handle]: {
          path,
          pubkey,
        },
      },
    });
  };

  const removeHandle = async (
    network: Network,
    handle: string,
  ): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot remove handle without handles");
    }
    const handlesMap = handles[network] || {};
    if (!(handle in handlesMap)) {
      return;
    }

    const { [handle]: removed, ...remainingHandles } = handlesMap;

    await saveKeystore({
      ...handles,
      [network]: remainingHandles,
    });
  };

  const setHandleCertData = async (
    network: Network,
    handle: string,
    cert: CertData | null,
  ): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot create handle without handles");
    }
    const handlesMap = handles[network] || {};
    const handleData = handlesMap[handle];
    if (handleData === undefined) {
      return;
    }

    if (handleData.cert && cert && areCertDataEqual(handleData.cert, cert)) {
      return;
    }

    const updatedHandleData = { ...handleData };

    if (cert === null) {
      delete updatedHandleData.cert;
    } else {
      updatedHandleData.cert = cert;
    }

    const updatedHandles = {
      ...handles,
      [network]: {
        ...handlesMap,
        [handle]: updatedHandleData,
      },
    };

    await saveKeystore(updatedHandles);
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <StoreContext.Provider
      value={{
        xpub,
        handles,
        getXprv,
        setupKeystore,
        createHandle,
        removeHandle,
        setHandleCertData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
};
