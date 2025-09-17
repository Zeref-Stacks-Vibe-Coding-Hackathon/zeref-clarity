;; LoopFi Vault - Main non-custodial vault for cross-chain yield looping
;; Handles deposit/withdraw, share accounting, events, and guards

;; Import traits (commented out for local testing)
;; (use-trait bridge-adapter-trait .bridge-adapter-trait.bridge-adapter-trait)

;; Constants
(define-constant ERR_PAUSED (err u100))
(define-constant ERR_NO_FUNDS (err u101))
(define-constant ERR_BAD_SHARES (err u102))
(define-constant ERR_NOT_KEEPER (err u103))
(define-constant ERR_NOT_ADMIN (err u104))
(define-constant ERR_CAP_EXCEEDED (err u105))
(define-constant ERR_STRATEGY_NOT_ALLOWED (err u106))
(define-constant ERR_INSUFFICIENT_BALANCE (err u107))
(define-constant ERR_TRANSFER_FAILED (err u108))
(define-constant ERR_ZERO_AMOUNT (err u109))
(define-constant ERR_ZERO_SHARES (err u110))

;; Constants for calculations
(define-constant BPS_DENOMINATOR u10000)
(define-constant INITIAL_EXCHANGE_RATE u1000000) ;; 1:1 ratio with 6 decimals

;; Data Variables
(define-data-var total-underlying uint u0)
(define-data-var total-shares uint u0)
(define-data-var deposit-fee-bps uint u0)
(define-data-var withdraw-fee-bps uint u0)
(define-data-var tvl-cap (optional uint) none)

;; Contract addresses
(define-data-var ystx-token-contract principal .ystx-token-v3)
(define-data-var roles-contract principal .roles-v3)
(define-data-var strategy-registry-contract principal .strategy-registry-v3)
(define-data-var bridge-adapter (optional principal) none)

;; Private functions

;; Check if caller is admin
(define-private (is-admin-caller)
  (contract-call? .roles-v3 is-admin tx-sender)
)

;; Check if caller is keeper
(define-private (is-keeper-caller)
  (contract-call? .roles-v3 is-keeper tx-sender)
)

;; Check if contract is paused
(define-private (is-paused)
  (contract-call? .roles-v3 is-contract-paused)
)

;; Assert not paused
(define-private (assert-not-paused)
  (begin
    (asserts! (not (is-paused)) ERR_PAUSED)
    (ok true)
  )
)

;; Calculate shares to mint for deposit
(define-private (calculate-deposit-shares (amount uint))
  (let (
    (current-total-underlying (var-get total-underlying))
    (current-total-shares (var-get total-shares))
  )
    (if (is-eq current-total-shares u0)
      amount ;; First deposit: 1:1 ratio
      (/ (* amount current-total-shares) current-total-underlying)
    )
  )
)

;; Calculate underlying amount for shares
(define-private (calculate-withdraw-amount (shares uint))
  (let (
    (current-total-underlying (var-get total-underlying))
    (current-total-shares (var-get total-shares))
  )
    (if (is-eq current-total-shares u0)
      u0
      (/ (* shares current-total-underlying) current-total-shares)
    )
  )
)

;; Apply fee to amount
(define-private (apply-fee (amount uint) (fee-bps uint))
  (- amount (/ (* amount fee-bps) BPS_DENOMINATOR))
)

;; Read-only functions

;; Get total underlying STX in vault
(define-read-only (get-total-underlying)
  (var-get total-underlying)
)

;; Get total shares (ySTX supply)
(define-read-only (get-total-shares)
  (var-get total-shares)
)

;; Get current exchange rate (underlying per share * 1M for precision)
(define-read-only (get-exchange-rate)
  (let (
    (current-total-underlying (var-get total-underlying))
    (current-total-shares (var-get total-shares))
  )
    (if (is-eq current-total-shares u0)
      INITIAL_EXCHANGE_RATE
      (/ (* current-total-underlying u1000000) current-total-shares)
    )
  )
)

;; Check if contract is paused
(define-read-only (get-paused)
  (is-paused)
)

;; Get fee configuration
(define-read-only (get-fees)
  {
    deposit-fee-bps: (var-get deposit-fee-bps),
    withdraw-fee-bps: (var-get withdraw-fee-bps)
  }
)

;; Get TVL cap
(define-read-only (get-cap)
  (var-get tvl-cap)
)

;; Preview deposit - calculate shares for amount
(define-read-only (preview-deposit (amount uint))
  (let (
    (fee-adjusted-amount (apply-fee amount (var-get deposit-fee-bps)))
  )
    (calculate-deposit-shares fee-adjusted-amount)
  )
)

;; Preview withdraw - calculate amount for shares
(define-read-only (preview-withdraw (shares uint))
  (let (
    (gross-amount (calculate-withdraw-amount shares))
  )
    (apply-fee gross-amount (var-get withdraw-fee-bps))
  )
)

;; Get user balance and estimated value
(define-read-only (get-user-balance (user principal))
  (let (
    (user-shares (unwrap-panic (contract-call? .ystx-token-v3 get-balance user)))
  )
    {
      shares: user-shares,
      est-amount: (preview-withdraw user-shares)
    }
  )
)

;; Public functions

;; Deposit STX and receive ySTX shares
(define-public (deposit (amount uint))
  (let (
    (fee-adjusted-amount (apply-fee amount (var-get deposit-fee-bps)))
    (shares-to-mint (calculate-deposit-shares fee-adjusted-amount))
    (new-total-underlying (+ (var-get total-underlying) fee-adjusted-amount))
  )
    (try! (assert-not-paused))
    (asserts! (> amount u0) ERR_ZERO_AMOUNT)
    (asserts! (> shares-to-mint u0) ERR_ZERO_SHARES)
    
    ;; Check TVL cap
    (match (var-get tvl-cap)
      cap (asserts! (<= new-total-underlying cap) ERR_CAP_EXCEEDED)
      true
    )
    
    ;; Transfer STX from user to vault
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    
    ;; Update vault state
    (var-set total-underlying new-total-underlying)
    (var-set total-shares (+ (var-get total-shares) shares-to-mint))
    
    ;; Mint ySTX tokens to user
    (try! (contract-call? .ystx-token-v3 mint shares-to-mint tx-sender))
    
    ;; Emit event
    (print {
      topic: "event-deposit",
      user: tx-sender,
      amount-stx: amount,
      shares: shares-to-mint,
      fee-bps: (var-get deposit-fee-bps)
    })
    
    (ok shares-to-mint)
  )
)

;; Withdraw STX by burning ySTX shares
(define-public (withdraw (shares uint))
  (let (
    (gross-amount (calculate-withdraw-amount shares))
    (net-amount (apply-fee gross-amount (var-get withdraw-fee-bps)))
  )
    (try! (assert-not-paused))
    (asserts! (> shares u0) ERR_ZERO_SHARES)
    (asserts! (> gross-amount u0) ERR_ZERO_AMOUNT)
    (asserts! (<= gross-amount (var-get total-underlying)) ERR_NO_FUNDS)
    
    ;; Burn ySTX tokens from user
    (try! (contract-call? .ystx-token-v3 burn shares tx-sender))
    
    ;; Update vault state
    (var-set total-underlying (- (var-get total-underlying) gross-amount))
    (var-set total-shares (- (var-get total-shares) shares))
    
    ;; Transfer STX to user
    (try! (as-contract (stx-transfer? net-amount tx-sender tx-sender)))
    
    ;; Emit event
    (print {
      topic: "event-withdraw",
      user: tx-sender,
      shares: shares,
      amount-stx: net-amount,
      fee-bps: (var-get withdraw-fee-bps)
    })
    
    (ok net-amount)
  )
)

;; Update virtual yield (keeper only) - simulates realized yield for MVP
(define-public (update-virtual-yield (delta int))
  (let (
    (current-underlying (var-get total-underlying))
    (new-underlying (if (>= delta 0) 
                      (+ current-underlying (to-uint delta))
                      (- current-underlying (to-uint (- delta)))))
  )
    (asserts! (is-keeper-caller) ERR_NOT_KEEPER)
    (asserts! (>= new-underlying u0) ERR_NO_FUNDS)
    
    (var-set total-underlying new-underlying)
    
    (print {
      topic: "virtual-yield-updated",
      delta: delta,
      new-total-underlying: new-underlying,
      by: tx-sender
    })
    
    (ok new-underlying)
  )
)

;; Request strategy change (keeper only)
(define-public (request-strategy-change 
  (from-chain uint) 
  (from-proto uint) 
  (to-chain uint) 
  (to-proto uint) 
  (amount uint) 
  (reason-code uint)
)
  (begin
    (asserts! (is-keeper-caller) ERR_NOT_KEEPER)
    (asserts! (contract-call? .strategy-registry-v3 validate-strategy to-chain to-proto amount) ERR_STRATEGY_NOT_ALLOWED)
    
    (print {
      topic: "event-strategy-change-requested",
      from-chain: from-chain,
      from-proto: from-proto,
      to-chain: to-chain,
      to-proto: to-proto,
      amount: amount,
      reason-code: reason-code,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Confirm bridge outbound (keeper only)
(define-public (confirm-bridge-outbound (to-chain uint) (amount uint) (payload-hash (buff 32)))
  (begin
    (asserts! (is-keeper-caller) ERR_NOT_KEEPER)
    
    ;; Bridge adapter functionality disabled for local testing
    ;; (match (var-get bridge-adapter)
    ;;   adapter (try! (contract-call? adapter transfer to-chain amount payload-hash))
    ;;   true ;; No adapter, just emit event
    ;; )
    
    (print {
      topic: "event-bridge-outbound",
      to-chain: to-chain,
      amount: amount,
      payload-hash: payload-hash,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Confirm bridge inbound (keeper only) - increases total underlying for MVP
(define-public (confirm-bridge-inbound (from-chain uint) (amount uint) (ref (buff 32)))
  (begin
    (asserts! (is-keeper-caller) ERR_NOT_KEEPER)
    
    ;; Increase total underlying to reflect external yield
    (var-set total-underlying (+ (var-get total-underlying) amount))
    
    (print {
      topic: "event-bridge-inbound",
      from-chain: from-chain,
      amount: amount,
      ref: ref,
      new-total-underlying: (var-get total-underlying),
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Update position info (keeper only)  
(define-public (update-position (chain uint) (proto uint) (apr-bps uint))
  (begin
    (asserts! (is-keeper-caller) ERR_NOT_KEEPER)
    
    (print {
      topic: "event-position-updated",
      chain: chain,
      proto: proto,
      apr-bps: apr-bps,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Admin functions

;; Set deposit fee (admin only)
(define-public (set-deposit-fee (fee-bps uint))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (asserts! (< fee-bps u1000) ERR_BAD_SHARES) ;; Max 10% fee
    (var-set deposit-fee-bps fee-bps)
    
    (print {
      topic: "deposit-fee-updated",
      fee-bps: fee-bps,
      by: tx-sender
    })
    
    (ok fee-bps)
  )
)

;; Set withdraw fee (admin only)
(define-public (set-withdraw-fee (fee-bps uint))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (asserts! (< fee-bps u1000) ERR_BAD_SHARES) ;; Max 10% fee
    (var-set withdraw-fee-bps fee-bps)
    
    (print {
      topic: "withdraw-fee-updated",
      fee-bps: fee-bps,
      by: tx-sender
    })
    
    (ok fee-bps)
  )
)

;; Set TVL cap (admin only)
(define-public (set-cap (cap (optional uint)))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (var-set tvl-cap cap)
    
    (print {
      topic: "cap-updated",
      cap: cap,
      by: tx-sender
    })
    
    (ok cap)
  )
)

;; Set bridge adapter (admin only)
(define-public (set-bridge-adapter (adapter (optional principal)))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (var-set bridge-adapter adapter)
    
    (print {
      topic: "bridge-adapter-updated",
      adapter: adapter,
      by: tx-sender
    })
    
    (ok adapter)
  )
)

;; Set contract addresses (admin only)
(define-public (set-ystx-token-contract (contract principal))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (var-set ystx-token-contract contract)
    (ok contract)
  )
)

(define-public (set-roles-contract (contract principal))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (var-set roles-contract contract)
    (ok contract)
  )
)

(define-public (set-strategy-registry-contract (contract principal))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (var-set strategy-registry-contract contract)
    (ok contract)
  )
)

;; Emergency functions

;; Emergency withdraw (admin only, when paused)
(define-public (emergency-withdraw (to principal) (amount uint))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_ADMIN)
    (asserts! (is-paused) ERR_NOT_ADMIN) ;; Only when paused
    (try! (as-contract (stx-transfer? amount tx-sender to)))
    
    (print {
      topic: "emergency-withdraw",
      to: to,
      amount: amount,
      by: tx-sender
    })
    
    (ok amount)
  )
)