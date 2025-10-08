export type CertData = {
  anchor: string;
  witness: {
    type: "subtree";
    data: string;
  };
};

export type Cert = CertData & {
  handle: string;
  script_pubkey: string;
};

export function isCertData(obj: unknown): obj is CertData {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const cert = obj as Partial<CertData>;
  if (typeof cert.anchor !== "string") {
    return false;
  }
  if (!cert.witness || typeof cert.witness !== "object") {
    return false;
  }
  const witness = cert.witness as Record<string, unknown>;
  if (witness.type !== "subtree") {
    return false;
  }
  if (typeof witness.data !== "string") {
    return false;
  }
  return true;
}

export function isCert(obj: unknown): obj is Cert {
  if (!isCertData(obj)) {
    return false;
  }
  const cert = obj as Partial<Cert>;
  if (typeof cert.handle !== "string") {
    return false;
  }
  if (typeof cert.script_pubkey !== "string") {
    return false;
  }
  return true;
}

export function extractCertData(cert: Cert): CertData {
  return {
    anchor: cert.anchor,
    witness: {
      type: "subtree",
      data: cert.witness.data,
    },
  };
}

export function buildCert(
  certData: CertData,
  handle: string,
  script_pubkey: string,
): Cert {
  return {
    handle,
    script_pubkey,
    ...certData,
  };
}
