import * as bip39 from "@scure/bip39";
import { HDKey } from "@scure/bip32";
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

export function prvFromPath(xprv: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  const derived = hdkey.derive(path);
  if (!derived.privateKey) {
    throw new Error("Unable to derive private key");
  }
  return Buffer.from(derived.privateKey).toString("hex");
}

export function p2trScriptFromPub(pub: string): string {
  return "5120" + pub;
}
