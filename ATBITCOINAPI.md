# atbitcoin.com API

Base URL: `https://testnet.atbitcoin.com/api`

All endpoints accept `POST` with `Content-Type: application/json`.

---

## POST `/proposed`

Search for available handle names matching a query.

### Request

```json
{
  "query": "alice"
}
```

| Field   | Type   | Description            |
| ------- | ------ | ---------------------- |
| `query` | string | Search term to look up |

### Response `200`

```json
{
  "available_subspaces": ["alice", "alice1", "aliceb"]
}
```

| Field                 | Type     | Description                                   |
| --------------------- | -------- | --------------------------------------------- |
| `available_subspaces` | string[] | Handle names available for the given query     |

---

## POST `/spaces/status`

Check the status of one or more handles.

### Request

```json
{
  "handles": ["alice", "bob"]
}
```

| Field     | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| `handles` | string[] | Handle names to check        |

### Response `200`

Returns an array of `HandleStatus` objects, one per requested handle.

```json
[
  { "handle": "alice", "status": "available" },
  { "handle": "bob",   "status": "taken", "script_pubkey": "5120ab..." }
]
```

#### HandleStatus variants

| `status`              | Additional fields                          | Description                                      |
| --------------------- | ------------------------------------------ | ------------------------------------------------ |
| `available`           | —                                          | Handle is available for registration              |
| `unknown`             | —                                          | Status could not be determined                    |
| `invalid`             | —                                          | Handle name is not valid                          |
| `preallocated`        | —                                          | Handle is reserved by the system                  |
| `reserved`            | `script_pubkey: string`                    | Handle is reserved, pending payment               |
| `processing_payment`  | `script_pubkey: string`                    | Payment is being processed                        |
| `taken`               | —                                          | Handle is registered (no owner details exposed)   |
| `taken`               | `script_pubkey: string`                    | Handle is registered to the given script pubkey   |
| `taken`               | `script_pubkey: string`, `certificate: Cert` | Handle is registered, with on-chain certificate |

#### Cert object

```json
{
  "handle": "alice",
  "script_pubkey": "5120ab...",
  "anchor": "deadbeef...",
  "witness": {
    "type": "subtree",
    "data": "cafebabe..."
  }
}
```

| Field           | Type   | Description                        |
| --------------- | ------ | ---------------------------------- |
| `handle`        | string | Handle name                        |
| `script_pubkey` | string | Owner script pubkey                |
| `anchor`        | string | Merkle tree anchor hash            |
| `witness.type`  | string | Always `"subtree"`                 |
| `witness.data`  | string | Subtree witness data               |

---

## POST `/reserve`

Reserve a handle for purchase.

### Request

```json
{
  "handle": "alice",
  "script_pubkey": "5120ab...",
  "payment_type": "iap"
}
```

| Field           | Type   | Description                               |
| --------------- | ------ | ----------------------------------------- |
| `handle`        | string | Handle name to reserve                    |
| `script_pubkey` | string | Owner script pubkey                       |
| `payment_type`  | string | Payment method — currently always `"iap"` |

### Response `200`

```json
{
  "deadline": 1713200000,
  "handle_status": { "handle": "alice", "status": "reserved", "script_pubkey": "5120ab..." },
  "product_id": "com.atbitcoin.handle"
}
```

| Field           | Type         | Description                                          |
| --------------- | ------------ | ---------------------------------------------------- |
| `deadline`      | number       | Unix timestamp — reservation expires after this time |
| `handle_status` | HandleStatus | Current handle status after reserving                |
| `product_id`    | string       | IAP product identifier for the purchase flow         |

### Error response (non-200)

Returns a plain-text error message in the response body.

---

## POST `/claim`

Claim a reserved handle after a successful in-app purchase.

### Request

```json
{
  "handle": "alice",
  "script_pubkey": "5120ab...",
  "purchase_token": "token-from-store...",
  "payment_method": "apple_iap"
}
```

| Field            | Type   | Description                                              |
| ---------------- | ------ | -------------------------------------------------------- |
| `handle`         | string | Handle name to claim                                     |
| `script_pubkey`  | string | Owner script pubkey                                      |
| `purchase_token` | string | Purchase receipt/token from the app store                |
| `payment_method` | string | One of `"google_iap"`, `"apple_iap"`, or `"test"`       |

### Response `200`

```json
{
  "handle_status": { "handle": "alice", "status": "taken", "script_pubkey": "5120ab..." }
}
```

| Field           | Type         | Description                                |
| --------------- | ------------ | ------------------------------------------ |
| `handle_status` | HandleStatus | Updated handle status after claiming       |
| `error`         | string?      | Present only if the claim failed           |
