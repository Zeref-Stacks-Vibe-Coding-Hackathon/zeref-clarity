# LoopFi Vault - Cross-Chain Yield Looping MVP

A production-ready Clarity contract suite for cross-chain yield looping on Stacks. Users deposit STX and receive ySTX receipt tokens, while off-chain resolvers and relayers handle cross-chain strategy execution.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Deposits │───▶│   LoopFi Vault  │───▶│  Strategy Exec  │
│      STX        │    │   (Stacks L1)    │    │ (Cross-chain)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   ySTX Tokens   │
                       │   (Receipts)    │
                       └─────────────────┘
```

## Contracts

### Core Contracts

1. **`vault.clar`** - Main vault contract
   - Handles STX deposits/withdrawals
   - Mints/burns ySTX receipt tokens
   - Emits events for off-chain indexer
   - Manages yield accounting

2. **`ystx-token.clar`** - SIP-010 fungible token
   - Receipt token representing vault shares
   - Only vault can mint/burn tokens
   - Standard SIP-010 interface

3. **`roles.clar`** - Role-based access control
   - Admin: Can set fees, cap, manage contracts
   - Keepers: Can update yield, request strategies
   - Pausers: Can emergency pause operations

4. **`strategy-registry.clar`** - Allowlisted strategies
   - Stores approved cross-chain strategies
   - Chain ID + Protocol ID mapping
   - Min/max amounts, fees, metadata

5. **`bridge-adapter-trait.clar`** - Bridge interface
   - Standard trait for bridge adapters
   - Pluggable cross-chain transfers

## Quick Start

### Installation & Testing

```bash
# Install dependencies
npm install

# Check contract syntax
clarinet check

# Run all tests
npm test

# Run specific test file
npm test -- --filter vault_test

# Run tests with coverage
npm run test:coverage

# Start local devnet
clarinet devnet start
```

### Test Commands

```bash
# Test individual contracts
npm test -- tests/vault_test.ts
npm test -- tests/roles_test.ts  
npm test -- tests/strategy_test.ts

# Run tests in watch mode
npm run test:watch

# Generate test report
npm run test:report
```

### Deployment

#### Testnet Deployment (Successful ✅)

All contracts have been successfully deployed to Stacks testnet with v2 naming:

- **bridge-adapter-trait-v2**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.bridge-adapter-trait-v2`
- **roles-v2**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.roles-v2`
- **sip-010-trait-v2**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.sip-010-trait-v2`
- **strategy-registry-v2**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.strategy-registry-v2`
- **ystx-token-v2**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.ystx-token-v2`
- **vault-v2**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.vault-v2`

#### Deployment Commands

```bash
# Generate deployment plan for testnet
clarinet deployments generate --testnet --high-cost

# Deploy to testnet
clarinet deployments apply --testnet --no-dashboard --use-computed-deployment-plan

# Check deployment status
# Visit: https://explorer.stacks.co/address/ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS?chain=testnet
```

#### Deployment Dependencies

The contracts must be deployed in this order:
1. `bridge-adapter-trait.clar`
2. `roles.clar`
3. `sip-010-trait.clar`
4. `strategy-registry.clar` 
5. `ystx-token.clar`
6. `vault.clar`

## Public Functions

### Vault Contract

#### Core Operations

**`deposit(amount: uint)`**
- Deposits STX and mints ySTX shares
- Emits: `event-deposit`
- Returns: shares minted

**`withdraw(shares: uint)`**
- Burns ySTX shares and returns STX
- Emits: `event-withdraw`  
- Returns: STX amount received

#### Read-Only Functions

**`get-exchange-rate()`**
- Returns: current underlying/shares ratio (6 decimals)

**`preview-deposit(amount: uint)`**
- Returns: estimated shares for deposit amount

**`preview-withdraw(shares: uint)`**
- Returns: estimated STX for share amount

**`get-user-balance(user: principal)`**
- Returns: `{shares: uint, est-amount: uint}`

#### Keeper Functions

**`update-virtual-yield(delta: int)`**
- Updates total underlying for yield simulation
- Only keepers can call

**`request-strategy-change(from-chain, from-proto, to-chain, to-proto, amount, reason-code)`**
- Signals strategy rebalancing to off-chain relayer
- Validates strategy via registry
- Emits: `event-strategy-change-requested`

**`confirm-bridge-outbound(to-chain, amount, payload-hash)`**
- Confirms cross-chain transfer initiated
- Emits: `event-bridge-outbound`

**`confirm-bridge-inbound(from-chain, amount, ref)`**
- Confirms yield received from cross-chain
- Increases total underlying
- Emits: `event-bridge-inbound`

#### Admin Functions

**`set-deposit-fee(fee-bps: uint)`**
- Sets deposit fee (max 10%)

**`set-withdraw-fee(fee-bps: uint)`**
- Sets withdraw fee (max 10%)

**`set-cap(cap: optional uint)`**
- Sets total value locked cap

## Events for Indexer

All events use structured `print` statements:

### Deposit Event
```clarity
{
  topic: "event-deposit",
  user: principal,
  amount-stx: uint,
  shares: uint,
  fee-bps: uint
}
```

### Withdraw Event
```clarity
{
  topic: "event-withdraw", 
  user: principal,
  shares: uint,
  amount-stx: uint,
  fee-bps: uint
}
```

### Strategy Change Request
```clarity
{
  topic: "event-strategy-change-requested",
  from-chain: uint,
  from-proto: uint, 
  to-chain: uint,
  to-proto: uint,
  amount: uint,
  reason-code: uint,
  by: principal
}
```

### Bridge Events
```clarity
{
  topic: "event-bridge-outbound",
  to-chain: uint,
  amount: uint,
  payload-hash: (buff 32),
  by: principal
}

{
  topic: "event-bridge-inbound",
  from-chain: uint,
  amount: uint,
  ref: (buff 32),
  new-total-underlying: uint,
  by: principal
}
```

### Position Update
```clarity
{
  topic: "event-position-updated",
  chain: uint,
  proto: uint,
  apr-bps: uint,
  by: principal
}
```

## Indexer Integration

### Event Processing Pipeline

1. **Listen for Events**: Subscribe to contract `print` events
2. **Parse Event Data**: Extract structured event payloads
3. **Update Database**: Store user balances, positions, history
4. **API Endpoints**: Expose data to frontend

### Recommended Frontend Endpoints

```
GET /api/v1/users/{address}/balance
GET /api/v1/users/{address}/history  
GET /api/v1/vault/stats
GET /api/v1/strategies/available
GET /api/v1/positions/current
```

## Demo Flow for Hackathon

### 1. Initial Setup
```clarity
;; Deploy contracts
;; Set vault in ySTX token
(contract-call? .ystx-token set-vault-contract .vault)

;; Add keeper
(contract-call? .roles add-keeper 'ST1KEEPER...)

;; Add strategy 
(contract-call? .strategy-registry add-strategy u2 u1 "Ethereum Aave" none u100000 u10000000 u50)
```

### 2. User Deposits
```clarity
;; User deposits 1000 STX
(contract-call? .vault deposit u1000000000) ;; 1000 STX in microSTX
;; → Receives 1000 ySTX (1:1 first deposit)
;; → Emits event-deposit
```

### 3. Simulate Cross-chain Strategy
```clarity
;; Keeper signals strategy change
(contract-call? .vault request-strategy-change u1 u0 u2 u1 u500000000 u1)
;; → Emits event-strategy-change-requested

;; Keeper confirms outbound bridge
(contract-call? .vault confirm-bridge-outbound u2 u500000000 0x1234...)
;; → Emits event-bridge-outbound

;; Simulate yield generation (keeper updates)
(contract-call? .vault update-virtual-yield 50000000) ;; 5% yield
;; → Total underlying increases
```

### 4. Yield Realization
```clarity
;; Keeper confirms inbound yield
(contract-call? .vault confirm-bridge-inbound u2 u25000000 0xabcd...)
;; → Emits event-bridge-inbound
;; → Total underlying increases further
```

### 5. User Withdrawal
```clarity
;; User withdraws all shares
(contract-call? .vault withdraw u1000000000)
;; → Burns 1000 ySTX
;; → Returns >1000 STX (due to yield)
;; → Emits event-withdraw
```

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| u100 | ERR_PAUSED | Contract is paused |
| u101 | ERR_NO_FUNDS | Insufficient vault funds |  
| u102 | ERR_BAD_SHARES | Invalid shares amount |
| u103 | ERR_NOT_KEEPER | Not authorized keeper |
| u104 | ERR_NOT_ADMIN | Not authorized admin |
| u105 | ERR_CAP_EXCEEDED | TVL cap exceeded |
| u106 | ERR_STRATEGY_NOT_ALLOWED | Strategy not in allowlist |

## Security Considerations

### Access Controls
- **Admin**: Can set parameters but cannot access user funds
- **Keepers**: Can update yield and signal strategies but cannot withdraw
- **Pausers**: Can emergency pause but cannot unpause (only admin)

### Yield Updates
- Virtual yield updates are for MVP demo only
- Production should validate yield via oracles or proof systems
- Negative yield updates are capped by available underlying

### Bridge Safety
- Bridge operations only emit events in MVP
- Actual bridge integration should use trusted adapters
- Payload hashes provide audit trail for cross-chain ops

### Fee Limits
- Deposit/withdraw fees capped at 10% (1000 bps)
- Exchange rate cannot be manipulated by external actors
- First deposit establishes 1:1 ratio to prevent inflation attacks

## Development Notes

### Constants
- Basis points denominator: 10,000 (100% = 10000 bps)
- Initial exchange rate: 1,000,000 (6 decimal precision)
- Max fee: 1,000 bps (10%)

### Testing Coverage
- ✅ First deposit 1:1 shares
- ✅ Pro-rata shares calculation  
- ✅ Yield updates affect exchange rate
- ✅ Fee application on deposit/withdraw
- ✅ Access control enforcement
- ✅ Pause functionality
- ✅ Strategy validation
- ✅ TVL cap enforcement
- ✅ Event emission verification

### Future Enhancements
- Oracle integration for yield validation  
- Multi-asset support beyond STX
- Automated rebalancing strategies
- Governance token for protocol decisions
- Flash loan protection mechanisms

---

**Built for Stacks hackathon - Production ready MVP for cross-chain yield looping** 🚀