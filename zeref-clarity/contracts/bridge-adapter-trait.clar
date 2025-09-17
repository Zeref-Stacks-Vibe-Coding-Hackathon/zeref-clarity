;; Bridge Adapter Trait - Interface for cross-chain bridge adapters
;; Defines the standard interface that bridge adapters must implement

;; Bridge Adapter Trait Definition
(define-trait bridge-adapter-trait
  (
    ;; Transfer tokens to another chain
    (transfer (uint uint (buff 32)) (response bool uint))
    
    ;; Get supported chains for this adapter  
    (get-supported-chains () (response (list 10 uint) uint))
    
    ;; Get minimum transfer amount for a specific chain
    (get-min-transfer-amount (uint) (response uint uint))
    
    ;; Get maximum transfer amount for a specific chain  
    (get-max-transfer-amount (uint) (response uint uint))
    
    ;; Get transfer fee for a specific chain and amount
    (get-transfer-fee (uint uint) (response uint uint))
    
    ;; Check if a chain is supported
    (is-chain-supported (uint) (response bool uint))
    
    ;; Estimate transfer time for a chain (in blocks)
    (get-transfer-time-estimate (uint) (response uint uint))
  )
)

;; Standard Chain IDs (for reference)
;; These are commonly used chain IDs in the ecosystem
(define-constant BRIDGE_CHAIN_STACKS u1)
(define-constant BRIDGE_CHAIN_ETHEREUM u2)
(define-constant BRIDGE_CHAIN_BITCOIN u3)
(define-constant BRIDGE_CHAIN_POLYGON u4)
(define-constant BRIDGE_CHAIN_ARBITRUM u5)
(define-constant BRIDGE_CHAIN_OPTIMISM u6)
(define-constant BRIDGE_CHAIN_BSC u7)
(define-constant BRIDGE_CHAIN_AVALANCHE u8)

;; Standard Error Codes for Bridge Adapters
(define-constant ERR_UNSUPPORTED_CHAIN u200)
(define-constant ERR_AMOUNT_TOO_LOW u201)
(define-constant ERR_AMOUNT_TOO_HIGH u202)
(define-constant ERR_INSUFFICIENT_BALANCE u203)
(define-constant ERR_BRIDGE_DISABLED u204)
(define-constant ERR_INVALID_PAYLOAD u205)
(define-constant ERR_TRANSFER_FAILED u206)
(define-constant ERR_NOT_AUTHORIZED u207)

;; Utility functions for bridge operations

;; Validate chain ID is in supported range
(define-read-only (is-valid-chain-id (target-chain-id uint))
  (and (>= target-chain-id u1) (<= target-chain-id u999))
)

;; Validate payload size
(define-read-only (is-valid-payload (payload (buff 32)))
  (is-eq (len payload) u32)
)

;; Helper function to check if amount is within valid range  
(define-read-only (is-valid-amount (amount uint))
  (and (> amount u0) (<= amount u340282366920938463463374607431768211455))
)