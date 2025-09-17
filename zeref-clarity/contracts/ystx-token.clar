;; ySTX Token - SIP-010 Fungible Token for LoopFi Vault Receipts
;; This contract implements a fungible token that represents shares in the LoopFi Vault

;; SIP-010 Trait
(impl-trait .sip-010-trait-v3.sip-010-trait)

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_OWNER_ONLY (err u100))
(define-constant ERR_NOT_TOKEN_OWNER (err u101))
(define-constant ERR_INSUFFICIENT_BALANCE (err u102))
(define-constant ERR_SENDER_IS_RECIPIENT (err u103))

;; Variables
(define-fungible-token ystx)
(define-data-var token-name (string-ascii 32) "Yield STX")
(define-data-var token-symbol (string-ascii 10) "ySTX")
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var token-decimals uint u6)

;; Vault contract that is authorized to mint/burn tokens
(define-data-var vault-contract (optional principal) none)

;; SIP-010 Functions

;; Get token name
(define-read-only (get-name)
  (ok (var-get token-name))
)

;; Get token symbol  
(define-read-only (get-symbol)
  (ok (var-get token-symbol))
)

;; Get token decimals
(define-read-only (get-decimals)
  (ok (var-get token-decimals))
)

;; Get total supply
(define-read-only (get-total-supply)
  (ok (ft-get-supply ystx))
)

;; Get token URI
(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; Get balance of account
(define-read-only (get-balance (who principal))
  (ok (ft-get-balance ystx who))
)

;; Transfer tokens
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq from tx-sender) (is-eq from contract-caller)) ERR_NOT_TOKEN_OWNER)
    (asserts! (not (is-eq from to)) ERR_SENDER_IS_RECIPIENT)
    (ft-transfer? ystx amount from to)
  )
)

;; Mint tokens - only callable by vault contract
(define-public (mint (amount uint) (to principal))
  (begin
    (asserts! (is-vault-authorized) ERR_OWNER_ONLY)
    (ft-mint? ystx amount to)
  )
)

;; Burn tokens - only callable by vault contract
(define-public (burn (amount uint) (from principal))
  (begin
    (asserts! (is-vault-authorized) ERR_OWNER_ONLY)
    (ft-burn? ystx amount from)
  )
)

;; Private functions

;; Check if caller is authorized vault contract
(define-private (is-vault-authorized)
  (match (var-get vault-contract)
    vault-addr (is-eq contract-caller vault-addr)
    false
  )
)

;; Admin functions

;; Set vault contract (only owner)
(define-public (set-vault-contract (vault principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
    (var-set vault-contract (some vault))
    (ok true)
  )
)

;; Set token URI (only owner)
(define-public (set-token-uri (uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
    (var-set token-uri uri)
    (ok true)
  )
)

;; Read-only getters for admin info
(define-read-only (get-vault-contract)
  (var-get vault-contract)
)

(define-read-only (get-contract-owner)
  CONTRACT_OWNER
)