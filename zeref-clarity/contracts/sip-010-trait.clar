;; SIP-010 Fungible Token Trait
;; Standard trait for fungible tokens on Stacks

(define-trait sip-010-trait
  (
    ;; Transfer from one principal to another
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    
    ;; Get the token name
    (get-name () (response (string-ascii 32) uint))
    
    ;; Get the token symbol
    (get-symbol () (response (string-ascii 32) uint))
    
    ;; Get the number of decimals used by the token
    (get-decimals () (response uint uint))
    
    ;; Get the total token supply
    (get-total-supply () (response uint uint))
    
    ;; Get the token balance of the given principal
    (get-balance (principal) (response uint uint))
    
    ;; Get the URI containing token metadata
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)