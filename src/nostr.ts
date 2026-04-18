import * as secp256k1 from "@noble/secp256k1";
import * as Crypto from "expo-crypto";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

secp256k1.hashes.sha256 = (message) => sha256(message);
secp256k1.hashes.hmacSha256 = (key, message) => hmac(sha256, key, message);

export type NostrEventData = {
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
};

export type NostrEvent = NostrEventData & {
  id: string;
  pubkey: string;
  sig: string;
};

export function isNostrEventData(obj: unknown): obj is NostrEventData {
  if (!obj || typeof obj !== "object") return false;
  const event = obj as Partial<NostrEventData>;

  return (
    typeof event.created_at === "number" &&
    typeof event.kind === "number" &&
    Array.isArray(event.tags) &&
    event.tags.every(
      (tag) =>
        Array.isArray(tag) && tag.every((item) => typeof item === "string"),
    ) &&
    typeof event.content === "string"
  );
}

export function isNostrEvent(obj: unknown): obj is NostrEvent {
  if (!isNostrEventData(obj)) {
    return false;
  }
  const event = obj as Partial<NostrEvent>;

  return (
    typeof event.id === "string" &&
    typeof event.pubkey === "string" &&
    typeof event.sig === "string"
  );
}

function getPub(prv: string): string {
  const privateKeyBytes = Buffer.from(prv, "hex");
  const publicKeyBytes = secp256k1.schnorr.getPublicKey(privateKeyBytes);
  return Buffer.from(publicKeyBytes).toString("hex");
}

async function getEventHash(
  pubkey: string,
  data: NostrEventData,
): Promise<string> {
  const serialized = JSON.stringify([
    0,
    pubkey,
    data.created_at,
    data.kind,
    data.tags,
    data.content,
  ]);

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    serialized,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return digest;
}

export async function signNostrEvent(
  data: NostrEventData,
  prv: string,
): Promise<NostrEvent> {
  const pubkey = getPub(prv);
  const id = await getEventHash(pubkey, data);

  const prvBytes = Buffer.from(prv, "hex");
  const hashBytes = Buffer.from(id, "hex");
  const sigBytes = secp256k1.schnorr.sign(hashBytes, prvBytes);
  const sig = Buffer.from(sigBytes).toString("hex");

  return {
    ...data,
    pubkey,
    id,
    sig,
  };
}

const PRIMAL_RELAY_URL = "wss://relay.primal.net/";

/** Publish a signed event to a Nostr relay (NIP-01 `EVENT`, NIP-20 `OK`). */
export function broadcastNostrEventToRelay(
  event: NostrEvent,
  relayUrl: string = PRIMAL_RELAY_URL,
  timeoutMs = 20000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(relayUrl);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Relay did not respond in time")));
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(JSON.stringify(["EVENT", event]));
    };

    ws.onmessage = (e) => {
      try {
        const raw = typeof e.data === "string" ? e.data : String(e.data);
        const msg = JSON.parse(raw) as unknown;
        if (!Array.isArray(msg) || msg.length < 3) return;
        if (msg[0] !== "OK" || msg[1] !== event.id) return;
        const accepted = msg[2] === true;
        const relayMsg = typeof msg[3] === "string" ? msg[3] : "";
        if (accepted) {
          finish(() => resolve());
        } else {
          finish(() =>
            reject(
              new Error(relayMsg.trim() || "Relay rejected the event"),
            ),
          );
        }
      } catch {
        /* ignore non-JSON or unrelated frames */
      }
    };

    ws.onerror = () => {
      finish(() => reject(new Error("Could not connect to relay")));
    };

    ws.onclose = () => {
      if (!settled) {
        finish(() => reject(new Error("Connection closed before relay reply")));
      }
    };
  });
}
