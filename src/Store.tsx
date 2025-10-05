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
import { CertData, isCertData } from "@/cert";
import { xpubFromXprv } from "@/keys";

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
  cert?: CertData;
};

function isHandleData(obj: unknown): obj is HandleData {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const handle = obj as Record<string, unknown>;
  if (typeof handle.path !== "string") {
    return false;
  }
  if (handle.cert !== undefined && !isCertData(handle.cert)) {
    return false;
  }
  return true;
}

export type Handles = Record<string, HandleData>;

export type KeystoreData = {
  xpub: string;
  handles: Handles;
};

export function isKeystoreData(obj: unknown): obj is KeystoreData {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const keystore = obj as Record<string, unknown>;
  if (typeof keystore.xpub !== "string") {
    return false;
  }
  if (!keystore.handles || typeof keystore.handles !== "object") {
    return false;
  }
  for (const value of Object.values(keystore.handles)) {
    if (!isHandleData(value)) {
      return false;
    }
  }
  return true;
}

type StoreContextType = {
  xpub: string | null;
  handles: Handles | null;
  getXprv: () => Promise<string | null>;
  setupKeystore: (xprv: string, handles: Handles) => Promise<void>;
  createHandle: (handle: string, cert?: string) => Promise<void>;
  removeHandle: (handle: string) => Promise<void>;
  setHandleCertData: (handle: string, cert: CertData | null) => Promise<void>;
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
        if (isKeystoreData(keystore)) {
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

    const keystore: KeystoreData = { xpub: xpubValue, handles: handlesValue };
    await AsyncStorage.setItem("keystore", JSON.stringify(keystore));
  };

  const getXprv = async (): Promise<string | null> => {
    return await secureStorage.getXprv();
  };

  const setupKeystore = async (
    xprv: string,
    handles: KeystoreData["handles"],
  ): Promise<void> => {
    await secureStorage.setXprv(xprv);
    await saveKeystore(handles, xpubFromXprv(xprv));
  };

  const createHandle = async (handle: string): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot create handle without handles");
    }

    if (handle in handles) {
      return;
    }

    let maxIndex = -1;

    for (const handleData of Object.values(handles)) {
      const match = handleData.path.match(/^m\/35053\/0\/0\/(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (index > maxIndex) {
          maxIndex = index;
        }
      }
    }

    const nextIndex = maxIndex + 1;
    const path = `m/35053/0/0/${nextIndex}`;

    await saveKeystore({
      ...handles,
      [handle]: {
        path,
      },
    });
  };

  const removeHandle = async (handle: string): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot remove handle without handles");
    }

    if (!(handle in handles)) {
      return;
    }

    const { [handle]: removed, ...remainingHandles } = handles;

    await saveKeystore(remainingHandles);
  };

  const setHandleCertData = async (
    handle: string,
    cert: CertData | null,
  ): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot create handle without handles");
    }

    const handleData = handles[handle];
    if (handleData === undefined) {
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
      [handle]: updatedHandleData,
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
