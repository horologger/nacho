import * as bip39 from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { bech32, bech32m } from "@scure/base";
import { Point } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { wordlist } from "@scure/bip39/wordlists/english";
import { randomBytes } from "@noble/hashes/utils.js";

export function generateMnemonic(): string {
  const entropy = randomBytes(16);
  return bip39.entropyToMnemonic(entropy, wordlist);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

export function xprvFromMnemonic(mnemonic: string): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, "");
  const hdkey = HDKey.fromMasterSeed(seed);
  return hdkey.privateExtendedKey;
}

export function xpubFromMnemonic(mnemonic: string): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, "");
  const hdkey = HDKey.fromMasterSeed(seed);
  return hdkey.publicExtendedKey;
}

export function xpubFromXprv(xprv: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  return hdkey.publicExtendedKey;
}

export function prvkeyFromXprv(xprv: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  const derived = hdkey.derive(path);

  if (!derived.privateKey) {
    throw new Error("Unable to derive private key");
  }

  return Buffer.from(derived.privateKey).toString("hex");
}

export function pubFromPath(xpub: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xpub);
  const derived = hdkey.derive(path);
  if (!derived.publicKey) {
    throw new Error("Unable to derive public key");
  }
  return Buffer.from(derived.publicKey).toString("hex").slice(2, 66);
}

export function pubFromXprv(xprv: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  const derived = hdkey.derive(path);
  if (!derived.publicKey) {
    throw new Error("Unable to derive public key");
  }
  return Buffer.from(derived.publicKey).toString("hex").slice(2, 66);
}

export function prvFromPath(xprv: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  const derived = hdkey.derive(path);
  if (!derived.privateKey) {
    throw new Error("Unable to derive private key");
  }
  return Buffer.from(derived.privateKey).toString("hex");
}

function taprootTweak(internalPubHex: string): string {
  const internalKey = Buffer.from(internalPubHex, "hex");
  const tag = sha256(new TextEncoder().encode("TapTweak"));
  const tweakMsg = new Uint8Array(tag.length + tag.length + internalKey.length);
  tweakMsg.set(tag, 0);
  tweakMsg.set(tag, tag.length);
  tweakMsg.set(internalKey, tag.length * 2);
  const tweakHash = sha256(tweakMsg);
  const tweakScalar = BigInt(
    "0x" + Buffer.from(tweakHash).toString("hex"),
  );
  const P = Point.fromHex("02" + internalPubHex);
  const Q = P.add(Point.BASE.multiply(tweakScalar));
  return Q.toHex(true).slice(2);
}

export function p2trScriptFromPub(pub: string): string {
  return "5120" + taprootTweak(pub);
}

export function p2trAddressFromPub(pub: string, mainnet: boolean): string {
  const hrp = mainnet ? "bc" : "tb";
  const outputKey = Buffer.from(taprootTweak(pub), "hex");
  const words = [1, ...bech32m.toWords(outputKey)];
  return bech32m.encode(hrp, words);
}

/** NIP-19 `npub` from 32-byte x-only secp256k1 pubkey hex (Taproot internal key). */
export function npubFromXOnlyPubHex(pubHex: string): string {
  const bytes = Buffer.from(pubHex, "hex");
  if (bytes.length !== 32) {
    throw new Error("Expected 32-byte x-only public key hex");
  }
  return bech32.encodeFromBytes("npub", new Uint8Array(bytes));
}
