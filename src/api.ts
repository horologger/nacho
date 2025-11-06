import { Cert, isCert } from "@/cert";

export async function fetchProposedHandles(query: string): Promise<string[]> {
  try {
    const response = await fetch("https://testnet.atbitcoin.com/api/proposed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }
    const data = await response.json();
    return data.available_subspaces || [];
  } catch (error) {
    console.error("Failed to fetch proposed handlers:", error);
    return [];
  }
}

export type HandleStatus =
  | {
      handle: string;
      status: "available" | "unknown" | "invalid";
      certificate: null;
    }
  | {
      handle: string;
      status: "taken";
      certificate: Cert | null;
    };

export function isHandleStatus(obj: unknown): obj is HandleStatus {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const h = obj as Partial<HandleStatus>;
  if (typeof h.handle !== "string") {
    return false;
  }
  if (
    h.status !== "available" &&
    h.status !== "taken" &&
    h.status !== "unknown" &&
    h.status !== "invalid"
  ) {
    return false;
  }
  if (h.certificate === null) {
    return true;
  }
  return (h.status === "taken") &&  isCert(h.certificate);
}

export async function fetchHandlesStatuses(
  handles: string[],
): Promise<HandleStatus[]> {
  try {
    const response = await fetch(
      "https://testnet.atbitcoin.com/api/spaces/status",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ handles }),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }
    const statuses = await response.json();
    if (!Array.isArray(statuses)) {
      throw new Error("Invalid API response");
    }
    for (const status of statuses) {
      if (!isHandleStatus(status)) {
        throw new Error("Invalid API response");
      }
    }
    return statuses;
  } catch (error) {
    console.error("Failed to fetch handlers status:", error);
    return [];
  }
}

export async function fetchHandleStatus(handle: string): Promise<HandleStatus> {
  const status = (await fetchHandlesStatuses([handle]))[0];
  if (status !== undefined) {
    return status;
  }
  return { handle, status: "unknown", certificate: null };
}
