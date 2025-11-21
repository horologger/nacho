import { Cert, CertData, isCert, isCertData } from "@/cert";

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
    }
  | {
      handle: string;
      status: "pending_payment";
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
    h.status !== "pending_payment" &&
    h.status !== "taken"
  ) {
    return false;
  }
  if (h.status === "pending_payment") {
    return typeof h.script_pubkey === "string";
  }
  if (h.status === "taken") {
    if (h.certificate !== undefined) {
      return typeof h.script_pubkey === "string" && isCert(h.certificate);
    }
    return h.script_pubkey === undefined && typeof h.script_pubkey === "string";
  }
  return true;
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
  return { handle, status: "unknown" };
}

export async function reserveHandle(
  handle: string,
  script_pubkey: string,
  payment_method: "google_iap",
): Promise<
  | {
      deadline: number;
      handle_status: HandleStatus;
      product_id: string;
    }
  | { error: string }
> {
  try {
    const response = await fetch("https://testnet.atbitcoin.com/api/reserve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        script_pubkey,
        payment_method,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: text };
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

export async function claimHandleGoogleIAP(
  handle: string,
  script_pubkey: string,
  purchase_token: string,
): Promise<{
  handle_status: HandleStatus;
  error?: string;
}> {
  try {
    const response = await fetch(
      "https://testnet.atbitcoin.com/api/android/claim",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle,
          script_pubkey,
          purchase_token,
        }),
      },
    );

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
