import { Cert, CertData, isCert, isCertData } from "@/cert";
import { Network } from "@/Store";

function getApiBaseUrl(network: Network): string {
  return network === "testnet4"
    ? "https://testnet.atbitcoin.com/api"
    : "https://testnet.atbitcoin.com/api";
}

async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  const method = init.method ?? "GET";
  const requestBody = JSON.parse(init.body as string);
  console.log(`[API →] ${method} ${url}`, requestBody);

  const response = await fetch(url, init);

  let responseBody: unknown;
  const clone = response.clone();
  try {
    responseBody = await clone.json();
  } catch {
    responseBody = await clone.text();
  }
  console.log(`[API ←] ${response.status} ${url}`, responseBody);

  return response;
}

export async function fetchProposedHandles(
  network: Network,
  query: string,
): Promise<string[]> {
  try {
    const response = await apiFetch(`${getApiBaseUrl(network)}/proposed`, {
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
      status: "available" | "unknown" | "invalid" | "preallocated";
    }
  | {
      handle: string;
      status: "reserved" | "processing_payment";
      script_pubkey: string;
    }
  | {
      handle: string;
      status: "taken";
    }
  | {
      handle: string;
      status: "taken";
      script_pubkey: string;
    }
  | {
      handle: string;
      status: "taken";
      script_pubkey: string;
      certificate: Cert;
    };

export function isHandleStatus(obj: unknown): obj is HandleStatus {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const h = obj as Record<string, unknown>;
  if (typeof h.handle !== "string") {
    return false;
  }
  if (
    h.status !== "available" &&
    h.status !== "unknown" &&
    h.status !== "invalid" &&
    h.status !== "preallocated" &&
    h.status !== "reserved" &&
    h.status !== "processing_payment" &&
    h.status !== "taken"
  ) {
    return false;
  }
  if (h.status === "reserved" || h.status === "processing_payment") {
    return typeof h.script_pubkey === "string";
  }
  if (h.status === "taken") {
    if (h.certificate !== undefined) {
      return typeof h.script_pubkey === "string" && isCert(h.certificate);
    }
    return h.script_pubkey === undefined || typeof h.script_pubkey === "string";
  }
  return true;
}

export async function fetchHandlesStatuses(
  network: Network,
  handles: string[],
): Promise<HandleStatus[]> {
  try {
    const response = await apiFetch(`${getApiBaseUrl(network)}/spaces/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ handles }),
    });
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

export async function fetchHandleStatus(
  network: Network,
  handle: string,
): Promise<HandleStatus> {
  const status = (await fetchHandlesStatuses(network, [handle]))[0];
  if (status !== undefined) {
    return status;
  }
  return { handle, status: "unknown" };
}

export async function reserveHandle(
  network: Network,
  handle: string,
  script_pubkey: string,
): Promise<
  | {
      deadline: number;
      handle_status: HandleStatus;
      product_id: string;
    }
  | { error: string }
> {
  try {
    const response = await apiFetch(`${getApiBaseUrl(network)}/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        script_pubkey,
        payment_type: "iap",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: text.trim() };
    }

    const data = await response.json();
    if (
      typeof data.deadline !== "number" ||
      !isHandleStatus(data.handle_status) ||
      typeof data.product_id !== "string"
    ) {
      throw new Error("Invalid API response");
    }
    return data;
  } catch (error) {
    console.error("Failed to reserve handle:", error);
    return { error: "Network error" };
  }
}

export async function claimHandleIAP(
  network: Network,
  handle: string,
  script_pubkey: string,
  purchase_token: string,
  payment_method: "google_iap" | "apple_iap" | "test",
): Promise<{
  handle_status: HandleStatus;
  error?: string;
}> {
  try {
    const response = await apiFetch(`${getApiBaseUrl(network)}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        script_pubkey,
        purchase_token,
        payment_method,
      }),
    });

    const data = await response.json();
    if (
      !isHandleStatus(data.handle_status) ||
      (data.error !== undefined && typeof data.error !== "string")
    ) {
      throw new Error("Invalid API response");
    }

    return data;
  } catch (error) {
    console.error("Failed to claim handle:", error);
    return {
      handle_status: { handle, status: "unknown" },
      error: "Network error",
    };
  }
}
