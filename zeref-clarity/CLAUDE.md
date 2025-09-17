You are a senior Stacks/Clarity engineer. Generate a production-ready Clarity contract suite for an MVP called **LoopFi Vault** that mints a receipt token **ySTX** and emits events used by an off-chain **Resolver** and **Relayer** to perform cross-chain looping. Use **Clarinet** conventions (project layout, tests). Write clean, well-commented code.

### Scope

Create:

1. `contracts/vault.clar` — main non-custodial vault (deposit/withdraw, share accounting, events, guards).
2. `contracts/ystx-token.clar` — SIP-010 fungible token (ySTX receipt).
3. `contracts/roles.clar` — simple role registry (ADMIN, KEEPERS, PAUSER).
4. `contracts/bridge-adapter-trait.clar` — trait describing a bridge adapter interface (for relayer stubs).
5. `contracts/strategy-registry.clar` — store allowlisted target strategies (chain id, protocol id, metadata).
6. **Tests** in `tests/` that cover core flows.
7. A short `README.md` explaining entrypoints, events, and how the indexer should consume them.

### Functional Requirements

* **Deposit/Withdraw**

  * `deposit()` receives native STX; mints ySTX proportional to total vault shares.
  * `withdraw(shares)` burns ySTX and returns underlying STX to caller.
  * Handle first deposit (no shares exist) and subsequent deposits (pro-rata).
  * Vault holds STX balance on Stacks; cross-chain deployment is only **signaled** via events (off-chain actor moves value; for MVP, yield can be accounted as “virtual APY” updated by keeper).

* **Accounting**

  * `total-underlying` (u128), `total-shares` (u128). Shares = ySTX supply.
  * `exchange-rate = total-underlying / total-shares` (read-only).
  * Optional fee variables (set 0 by default): `deposit-fee-bps`, `withdraw-fee-bps`.
  * `cap` TVL (optional; default none).

* **Roles & Guards**

  * `roles.clar` exposes:

    * `is-admin`, `is-keeper`, `is-pauser`
    * `set-admin`, `add-keeper`, `remove-keeper`, `set-paused(bool)`
  * `vault.clar` checks:

    * only **KEEPER** can call `update-virtual-yield`, `request-strategy-change`.
    * only **ADMIN** can set fees, cap, registry/adapter addresses.
    * when paused → block deposit/withdraw/strategy ops (read-only allowed).

* **Strategy & Looping Signals**

  * `strategy-registry.clar`:

    * `add-strategy(chain-id uint, proto-id uint, name (buff 32), addr (optional principal))` only ADMIN
    * `enable/disable-strategy`.
    * `get-strategy(chain-id, proto-id)`.
  * `vault.clar` emits events to drive the off-chain resolver/relayer:

    * `event-deposit { user: principal, amount-stx: uint, shares: uint }`
    * `event-withdraw { user: principal, shares: uint, amount-stx: uint }`
    * `event-strategy-change-requested { from-chain: uint, from-proto: uint, to-chain: uint, to-proto: uint, amount: uint, reason-code: uint }`
    * `event-bridge-outbound { to-chain: uint, amount: uint, payload-hash: (buff 32) }`
    * `event-bridge-inbound { from-chain: uint, amount: uint, ref: (buff 32) }`
    * `event-position-updated { chain: uint, proto: uint, apr-bps: uint }`
  * `request-strategy-change(to-chain, to-proto, amount, reason-code)` → **KEEPER** only; validates allowlist via registry; only signals.
  * `confirm-bridge-outbound(to-chain, amount, payload-hash)` → **KEEPER** only; emits outbound event.
  * `confirm-bridge-inbound(from-chain, amount, ref)` → **KEEPER** only; increases `total-underlying` to reflect external yield (for MVP).
  * `update-virtual-yield(delta)` → **KEEPER** only; bumps `total-underlying` to simulate realized yield for demo.

* **Bridge Adapter Trait**

  * Define `bridge-adapter-trait` with `transfer(to-chain uint, amount uint, payload (buff 32)) -> (response bool uint)`.
  * `vault.clar` stores optional `bridge-adapter` principal; calls it if set, else only emits events.

* **Read-only Views**

  * `get-total-underlying`, `get-total-shares`, `get-exchange-rate`, `get-paused`, `get-fees`, `get-cap`.
  * `preview-deposit(amount) -> shares`, `preview-withdraw(shares) -> amount`.
  * `get-user-balance(user) -> { shares, est-amount }`.

* **Errors**

  * `ERR-PAUSED u100`, `ERR-NO-FUNDS u101`, `ERR-BAD-SHARES u102`, `ERR-NOT-KEEPER u103`, `ERR-NOT-ADMIN u104`, `ERR-CAP-EXCEEDED u105`, `ERR-STRATEGY-NOT-ALLOWED u106`.

### Events (clarinet `print` pattern)

Use `print` with structured tuples so indexer can parse:

* Example: `(print { topic: "event-deposit", user: tx-sender, amount: amount, shares: shares })`
  Ensure **all** state-changing public entrypoints print an event.

### Tests (Clarinet `tests/` in TypeScript or Rust)

Write tests for:

1. First deposit → shares == amount, events emitted.
2. Second deposit → pro-rata shares.
3. Withdraw full/partial → burns shares, returns STX, event emitted.
4. Pause blocks deposit/withdraw.
5. Admin/keeper role checks.
6. Strategy allowlist validation.
7. `request-strategy-change` → emits event with correct params.
8. `update-virtual-yield` increases exchange rate; withdraw reflects yield.
9. Cap TVL blocks excess deposit.

### Project Layout

```
Clarinet.toml
contracts/
  vault.clar
  ystx-token.clar
  roles.clar
  bridge-adapter-trait.clar
  strategy-registry.clar
tests/
  vault_test.ts
  roles_test.ts
  strategy_test.ts
README.md
```

### README Requirements

Explain:

* How to run: `clarinet check`, `clarinet test`.
* Public functions and expected events (with sample payload).
* How an **indexer** should listen and map events → FE endpoints.
* Demo flow for hackathon: deposit → keeper `update-virtual-yield` → `request-strategy-change` → outbound/inbound confirmations → withdraw.

### Conventions

* Use unsigned ints (`uint`) and **no floating point**; APR/APY in **basis points**.
* Keep code deterministic; no randomness.
* Heavily comment each entrypoint.
* Return `(ok ...)` / `(err uXXX)` consistently.

Deliver all contract files, tests, and a concise README in one response.

---

Kalau sudah jadi, kirimkan ke aku output Claude-nya; aku bantu review cepat (cek perhitungan shares, guard rails, dan event payload) sebelum kamu lanjut integrasi ke indexer/FE.
