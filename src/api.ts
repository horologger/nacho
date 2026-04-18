import { Cert, CertData, isCert, isCertData } from "@/cert";
import { Network } from "@/Store";

function getApiBaseUrl(network: Network): string {
  // return network === "testnet4"
  //   ? "https://testnet.atbitcoin.com/api"
  //   : "https://testnet.atbitcoin.com/api";
    return network === "testnet4"
    ? "https://testnet.spacesops.com/api"
    : "https://spacesops.com/api";
}

async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  const method = init.method ?? "GET";
  const requestBody = JSON.parse(init.body as string);
  console.log(`[API →] ${method} ${url}`, requestBody);

  const response = await fetch(url, init);
  const text = await response.text();

  let responseBody: unknown;
  try {
    responseBody = JSON.parse(text);
  } catch {
    responseBody = text;
  }
  console.log(`[API ←] ${response.status} ${url}`, responseBody);

  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export type ProposedHandlesResult = {
  state: "available" | "taken";
  handles: string[];
};

export async function fetchProposedHandles(
  network: Network,
  query: string,
): Promise<ProposedHandlesResult> {
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
    return {
      state: data.state === "taken" ? "taken" : "available",
      handles: data.handles || data.available_subspaces || [],
    };
  } catch (error) {
    console.error("Failed to fetch proposed handlers:", error);
    return { state: "available", handles: [] };
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

const CERT_REQUEST_FILE_EXISTS_RE =
  /Certificate request file already exists/i;

const FRIENDLY_CERT_REQUEST_CONFLICT =
  "A certificate request for this handle is already on the server. " +
  'Use Remove Handle, then add a different handle name and try sending your request again.';

function friendlySendHandleAddError(raw: string, httpStatus: number): string {
  const trimmed = raw.trim();
  const matchesConflict = (msg: string) =>
    CERT_REQUEST_FILE_EXISTS_RE.test(msg);

  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown };
    if (typeof parsed.error === "string") {
      if (matchesConflict(parsed.error)) {
        return FRIENDLY_CERT_REQUEST_CONFLICT;
      }
      return parsed.error;
    }
  } catch {
    /* body is not JSON */
  }

  if (matchesConflict(trimmed)) {
    return FRIENDLY_CERT_REQUEST_CONFLICT;
  }

  return trimmed || `HTTP ${httpStatus}`;
}

export async function sendHandleAddRequest(
  network: Network,
  handle: string,
  script_pubkey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parts = handle.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Invalid handle format" };
  }
  const space = parts[1];
  try {
    const response = await apiFetch(
      `${getApiBaseUrl(network)}/subsd/spaces/${encodeURIComponent(space)}/add`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ handle, script_pubkey }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        error: friendlySendHandleAddError(text, response.status),
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("Failed to send handle add request:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchHandleCertificateJson(
  network: Network,
  handle: string,
): Promise<
  | { ok: true; data: unknown }
  | { ok: false; error: string; status?: number }
> {
  const parts = handle.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Invalid handle format" };
  }
  const subname = parts[0];
  const spaceName = parts[1];
  const url = `${getApiBaseUrl(network)}/subsd/spaces/${encodeURIComponent(spaceName)}/${encodeURIComponent(subname)}/cert.json`;
  try {
    console.log(`[API →] GET ${url}`);
    const response = await fetch(url);
    const text = await response.text();
    let responseBody: unknown;
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }
    console.log(`[API ←] ${response.status} ${url}`, responseBody);
    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof responseBody === "string"
            ? responseBody.trim()
            : `HTTP ${response.status}`,
        status: response.status,
      };
    }
    return { ok: true, data: responseBody };
  } catch (error) {
    console.error("Failed to fetch certificate JSON:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
