# iExec Nox Tooling Feedback

This feedback is based on migrating Noxage, a confidential batch-intent
settlement application, from an fhEVM-oriented implementation to iExec Nox.
Noxage encrypts user direction, amount, and limit values, nets opposing flow,
and reveals only the aggregate residual needed for a public AMM transaction.

## What Worked Well

### Familiar Solidity API

The `Nox` Solidity library maps well to an existing confidential-contract
design. Helpers such as `fromExternal`, `add`, `sub`, `select`, `allow`,
`allowThis`, viewer management, and `publicDecrypt` preserve the broad shape of
an fhEVM-style application. This reduced the conceptual rewrite: the intent
book, epoch lifecycle, fill ledger, and netting algorithm can remain recognizable
while the encrypted value implementation moves to Nox handles and TEE-backed
operations.

The `Nox.noxComputeContract()` chain resolution is also useful. It gives
application contracts one canonical route to the protocol contract and avoids
passing a sensitive infrastructure address through every constructor.

### Handle SDK Covers the Full Browser Flow

`@iexec-nox/handle` exposes the operations the frontend needs in one client:

- `encryptInput` for contract-bound encrypted inputs and proofs;
- `decrypt` for authorized user disclosure with an EIP-712 signature;
- `publicDecrypt` for aggregate values and a contract-verifiable proof;
- `viewACL` for inspecting public, admin, and viewer permissions.

The viem factory is especially helpful for this repository because Noxage
already uses viem for wallet and contract interactions.

### Ethereum Sepolia Defaults

The installed Handle SDK contains a complete Ethereum Sepolia configuration:
gateway, NoxCompute proxy, and subgraph. The installed Solidity SDK resolves the
same NoxCompute proxy, `0x24Ef36Ec5b626D7DCD09a98F3083c2758F0F77bF`, for
chain ID `11155111`. Having matching defaults in both packages removes several
manual deployment mistakes.

The package README in `0.1.0-beta.13` says built-in defaults include only
Arbitrum Sepolia, while `src/config/networks.ts` also includes Ethereum Sepolia.
The source is what the factory executes, but the discrepancy can send
integrators toward unnecessary custom configuration.

We also compiled and deployed a small Nox-based contract on Ethereum Sepolia
during integration exploration. This confirmed basic package resolution and
network deployment, but it did not exercise Noxage's complete settlement flow.

## Friction Encountered

### Implemented Type Support Is Narrower Than the Public Type Union

The Handle SDK exports a broad `SolidityType` union, but the current protocol
implementation supports encryption for only:

- `bool`
- `uint16`
- `uint256`
- `int16`
- `int256`

Noxage originally used encrypted `uint8` for direction and `uint64` for amounts
and limits. Those types could not be migrated by changing imports alone. The
migrated source now represents direction as `bool` and monetary values as
`uint256`, with corresponding contract, ABI, frontend serialization, and test
changes.

It would help if unsupported values were excluded from the primary input type
at compile time, or if the README placed the implemented subset before examples
that show currently unsupported types such as `address` and fixed bytes.

### Configuration Discovery Could Be More Direct

The README describes a `Config` override and says unsupported chains require
all three values, but locating the exact built-in network defaults required
reading the distributed package's `networks.js`. A public exported helper or a
small documented table containing chain ID, gateway, NoxCompute, and subgraph
would make deployment review easier.

The naming could also be aligned across documentation. The Handle SDK calls the
on-chain value `smartContractAddress`, while the Solidity documentation and
protocol architecture call it `NoxCompute`. Naming it `noxComputeAddress` in the
client config would make its purpose clearer to application developers.

### Documentation Routes Have Drifted

Package READMEs, npm metadata, and hackathon material point to multiple
documentation entry points. Some links lead to the general iExec documentation
rather than the exact Nox SDK or deployment section needed for a migration.
Versioned documentation tied to each npm release would reduce uncertainty when
the package API and hosted docs evolve at different speeds.

A migration guide from fhEVM-style contracts would be particularly valuable.
The APIs are intentionally familiar, but proof formats, supported encrypted
types, ACL behavior, off-chain execution, and client configuration are not
drop-in compatible.

### Local Testing Guidance Needs an Application Example

The protocol contract repository documents its own tests, but an application
developer needs a concise recipe for testing a contract that imports `Nox.sol`.
An official example covering local NoxCompute setup, input-proof generation,
confidential operation completion, ACL assignment, and public-decryption proof
verification would make migration validation substantially faster.

## Sepolia Deployment Experience

The Ethereum Sepolia constants in the installed Solidity and Handle packages
agree, which is a strong default. The remaining operational concern is keeping
four pieces synchronized:

1. the Nox protocol package version compiled into the application;
2. the NoxCompute address resolved by `Nox.sol`;
3. the Handle SDK gateway and subgraph configuration;
4. the application contracts and deployment metadata consumed by the frontend.

For Noxage, the migration changes privacy-dependent bytecode and write-once
contract wiring. Existing Sepolia addresses from the fhEVM implementation
cannot be reused. A fresh coordinated deployment is required, followed by
verification that browser encryption proofs are accepted by the deployed
contracts and that public-decryption proofs finalize the intended residual.

## Verification Status

We are not claiming a successful Noxage end-to-end Nox run yet.

Completed or observed:

- Nox protocol, confidential-contract, and Handle SDK packages are installed.
- The Nox Solidity API and Handle SDK configuration were inspected directly.
- Production contract source uses Nox `ebool` and `euint256` primitives,
  Nox public-decryption proof checks, and Nox ERC-7984 wrappers.
- The web client uses `@iexec-nox/handle` for input encryption, authorized
  decryption, and public decryption.
- The web adapter validates returned Solidity types and accepts endpoint
  overrides only when gateway, NoxCompute, and subgraph are all supplied.
- On July 30, 2026, `pnpm contracts:test` reported 11 passing tests.
- On July 30, 2026, `pnpm run lint` completed with zero errors and one warning.
- On July 30, 2026, `pnpm run build` completed successfully; it logged
  non-fatal dynamic-font download warnings.
- A small Nox-based contract compiled and deployed on Ethereum Sepolia.
- The pre-migration fhEVM contract suite passed its local tests.
- Deployment scripts now stamp a coordinated deployment identity and reject
  phase mixing with legacy or unrelated metadata.
- A read-only Sepolia preflight checks code, owners, wiring, token underlyings,
  and pair configuration before operator actions.
- On July 30, 2026, a fresh coordinated Noxage deployment completed and the
  read-only Sepolia preflight passed for deployment
  `fa2e5b97-1101-44e2-9e6f-16fea41493bb`.

Still required:

- perform a clean migrated-contract compilation if fresh-artifact evidence is
  required; the observed compile command reported no changed sources to compile;
- exercise confidential arithmetic and ACL behavior against a Nox-backed
  runtime rather than only local ABI, wiring, and access-control tests;
- encrypt and submit a real intent through `@iexec-nox/handle`;
- complete confidential batch netting through NoxCompute;
- obtain and verify a Nox public-decryption proof;
- execute both zero-residual and non-zero-residual settlement paths;
- decrypt an authorized fill and reject an unauthorized viewer;
- freshly deploy and verify the complete contract set on Ethereum Sepolia;
- pass the coordinated Noxage preflight against that fresh deployment;
- run the web application against those new addresses without mock data.

## Highest-Impact Improvements

1. Publish a versioned application starter using Hardhat, viem, Nox contracts,
   and the Handle SDK together.
2. Make implemented encrypted types a narrower exported TypeScript type and
   list them prominently in Solidity package documentation.
3. Export or document network defaults in one stable table.
4. Add a migration guide explaining the differences between familiar FHE-style
   APIs and Nox handle, proof, ACL, and TEE semantics.
5. Provide an end-to-end Sepolia checklist that verifies package versions,
   NoxCompute, gateway, subgraph, input proofs, and public-decryption proofs.
