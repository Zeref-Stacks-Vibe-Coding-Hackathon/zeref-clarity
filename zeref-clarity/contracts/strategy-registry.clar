;; Strategy Registry - Store allowlisted target strategies for cross-chain looping
;; Manages chain ID, protocol ID, metadata for supported yield strategies

;; Import roles contract (commented out for local testing)
;; (use-trait roles-trait .roles.roles-trait)

;; Constants
(define-constant ERR_NOT_AUTHORIZED (err u100))
(define-constant ERR_STRATEGY_NOT_FOUND (err u101))
(define-constant ERR_STRATEGY_ALREADY_EXISTS (err u102))
(define-constant ERR_STRATEGY_DISABLED (err u103))
(define-constant ERR_INVALID_PARAMETERS (err u104))

;; Data Variables
(define-data-var roles-contract principal .roles-v3)

;; Strategy Data Structure
(define-map strategies 
  {strategy-chain-id: uint, strategy-proto-id: uint}
  {
    name: (buff 32),
    addr: (optional principal),
    enabled: bool,
    min-amount: uint,
    max-amount: uint,
    fee-bps: uint,
    created-at: uint,
    updated-at: uint
  }
)

;; Strategy metadata for UI/indexer
(define-map strategy-metadata
  {strategy-chain-id: uint, strategy-proto-id: uint}
  {
    description: (buff 256),
    website: (buff 128),
    logo-url: (buff 256),
    risk-level: uint,
    expected-apr-bps: uint
  }
)

;; List of all strategy keys for enumeration
(define-data-var strategy-keys (list 100 {strategy-chain-id: uint, strategy-proto-id: uint}) (list))
(define-data-var strategy-count uint u0)

;; Events
(define-private (emit-strategy-event (event-data {topic: (string-ascii 32)}))
  (print event-data)
)

;; Private functions

;; Check if caller is admin via roles contract
(define-private (is-admin-caller)
  (contract-call? .roles-v3 is-admin tx-sender)
)

;; Get current block height
(define-private (get-current-height)
  u1 ;; Simplified for testing
)

;; Read-only functions

;; Get strategy details
(define-read-only (get-strategy (chain-identifier uint) (proto-identifier uint))
  (map-get? strategies {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier})
)

;; Get strategy metadata
(define-read-only (get-strategy-metadata (chain-identifier uint) (proto-identifier uint))
  (map-get? strategy-metadata {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier})
)

;; Check if strategy exists
(define-read-only (strategy-exists (chain-identifier uint) (proto-identifier uint))
  (is-some (get-strategy chain-identifier proto-identifier))
)

;; Check if strategy is enabled
(define-read-only (is-strategy-enabled (chain-identifier uint) (proto-identifier uint))
  (match (get-strategy chain-identifier proto-identifier)
    strategy (get enabled strategy)
    false
  )
)

;; Get all strategy keys
(define-read-only (get-all-strategies)
  (var-get strategy-keys)
)

;; Get strategy count
(define-read-only (get-strategy-count)
  (var-get strategy-count)
)

;; Get strategies for specific chain - simplified implementation
(define-read-only (get-strategies-for-chain (target-chain-id uint))
  (let ((all-strategies (var-get strategy-keys)))
    all-strategies ;; Return all for now - filter implementation needs manual loop in Clarity
  )
)

;; Get enabled strategies only - simplified
(define-read-only (get-enabled-strategies)
  (var-get strategy-keys) ;; Return all for now - filter needs manual implementation
)

;; Helper function for filtering by chain ID - simplified for Clarity
(define-private (is-chain-match (strategy-key {strategy-chain-id: uint, strategy-proto-id: uint}) (target-chain-id uint))
  (is-eq (get strategy-chain-id strategy-key) target-chain-id)
)

;; Helper function to check if strategy key is enabled
(define-private (is-strategy-key-enabled (strategy-key {strategy-chain-id: uint, strategy-proto-id: uint}))
  (is-strategy-enabled (get strategy-chain-id strategy-key) (get strategy-proto-id strategy-key))
)

;; Public functions

;; Add new strategy (only admin)
(define-public (add-strategy 
  (chain-identifier uint) 
  (proto-identifier uint) 
  (name (buff 32)) 
  (addr (optional principal))
  (min-amount uint)
  (max-amount uint)
  (fee-bps uint)
)
  (let (
    (strategy-key {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier})
    (current-height (get-current-height))
  )
    (asserts! (is-admin-caller) ERR_NOT_AUTHORIZED)
    (asserts! (> chain-identifier u0) ERR_INVALID_PARAMETERS)
    (asserts! (> proto-identifier u0) ERR_INVALID_PARAMETERS)
    (asserts! (< fee-bps u10000) ERR_INVALID_PARAMETERS)
    (asserts! (not (strategy-exists chain-identifier proto-identifier)) ERR_STRATEGY_ALREADY_EXISTS)
    
    ;; Add strategy
    (map-set strategies {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier} {
      name: name,
      addr: addr,
      enabled: true,
      min-amount: min-amount,
      max-amount: max-amount,
      fee-bps: fee-bps,
      created-at: current-height,
      updated-at: current-height
    })
    
    ;; Add to strategy keys list
    (var-set strategy-keys (unwrap-panic (as-max-len? (append (var-get strategy-keys) strategy-key) u100)))
    (var-set strategy-count (+ (var-get strategy-count) u1))
    
    ;; Emit event
    (print {
      topic: "strategy-added",
      chain-id: chain-identifier,
      proto-id: proto-identifier,
      name: name,
      enabled: true,
      by: tx-sender
    })
    
    (ok strategy-key)
  )
)

;; Update strategy metadata (only admin)
(define-public (set-strategy-metadata
  (chain-identifier uint)
  (proto-identifier uint)
  (description (buff 256))
  (website (buff 128))
  (logo-url (buff 256))
  (risk-level uint)
  (expected-apr-bps uint)
)
  (begin
    (asserts! (is-admin-caller) ERR_NOT_AUTHORIZED)
    (asserts! (strategy-exists chain-identifier proto-identifier) ERR_STRATEGY_NOT_FOUND)
    (asserts! (<= risk-level u5) ERR_INVALID_PARAMETERS)
    
    (map-set strategy-metadata {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier} {
      description: description,
      website: website,
      logo-url: logo-url,
      risk-level: risk-level,
      expected-apr-bps: expected-apr-bps
    })
    
    (print {
      topic: "strategy-metadata-updated",
      chain-id: chain-identifier,
      proto-id: proto-identifier,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Enable strategy (only admin)
(define-public (enable-strategy (chain-identifier uint) (proto-identifier uint))
  (let (
    (strategy-key {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier})
    (current-strategy (unwrap! (get-strategy chain-identifier proto-identifier) ERR_STRATEGY_NOT_FOUND))
  )
    (asserts! (is-admin-caller) ERR_NOT_AUTHORIZED)
    
    (map-set strategies strategy-key (merge current-strategy {
      enabled: true,
      updated-at: (get-current-height)
    }))
    
    (print {
      topic: "strategy-enabled",
      chain-id: chain-identifier,
      proto-id: proto-identifier,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Disable strategy (only admin)
(define-public (disable-strategy (chain-identifier uint) (proto-identifier uint))
  (let (
    (strategy-key {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier})
    (current-strategy (unwrap! (get-strategy chain-identifier proto-identifier) ERR_STRATEGY_NOT_FOUND))
  )
    (asserts! (is-admin-caller) ERR_NOT_AUTHORIZED)
    
    (map-set strategies strategy-key (merge current-strategy {
      enabled: false,
      updated-at: (get-current-height)
    }))
    
    (print {
      topic: "strategy-disabled", 
      chain-id: chain-identifier,
      proto-id: proto-identifier,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Update strategy parameters (only admin)
(define-public (update-strategy-params
  (chain-identifier uint)
  (proto-identifier uint)
  (min-amount uint)
  (max-amount uint)
  (fee-bps uint)
)
  (let (
    (strategy-key {strategy-chain-id: chain-identifier, strategy-proto-id: proto-identifier})
    (current-strategy (unwrap! (get-strategy chain-identifier proto-identifier) ERR_STRATEGY_NOT_FOUND))
  )
    (asserts! (is-admin-caller) ERR_NOT_AUTHORIZED)
    (asserts! (< fee-bps u10000) ERR_INVALID_PARAMETERS)
    (asserts! (<= min-amount max-amount) ERR_INVALID_PARAMETERS)
    
    (map-set strategies strategy-key (merge current-strategy {
      min-amount: min-amount,
      max-amount: max-amount,
      fee-bps: fee-bps,
      updated-at: (get-current-height)
    }))
    
    (print {
      topic: "strategy-params-updated",
      chain-id: chain-identifier,
      proto-id: proto-identifier,
      min-amount: min-amount,
      max-amount: max-amount,
      fee-bps: fee-bps,
      by: tx-sender
    })
    
    (ok true)
  )
)

;; Validate strategy for use (used by vault)
(define-read-only (validate-strategy (chain-identifier uint) (proto-identifier uint) (amount uint))
  (match (get-strategy chain-identifier proto-identifier)
    strategy (and
      (get enabled strategy)
      (>= amount (get min-amount strategy))
      (<= amount (get max-amount strategy))
    )
    false
  )
)

;; Set roles contract (only current admin)
(define-public (set-roles-contract (new-roles-contract principal))
  (begin
    (asserts! (is-admin-caller) ERR_NOT_AUTHORIZED)
    (var-set roles-contract new-roles-contract)
    (ok new-roles-contract)
  )
)