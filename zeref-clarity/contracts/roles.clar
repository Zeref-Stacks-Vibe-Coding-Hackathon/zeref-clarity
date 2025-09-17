;; Roles Contract - Simple role registry for LoopFi Vault
;; Manages ADMIN, KEEPER, and PAUSER roles with pause functionality

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u100))
(define-constant ERR_ALREADY_EXISTS (err u101))
(define-constant ERR_NOT_FOUND (err u102))

;; Data Variables
(define-data-var contract-admin principal CONTRACT_OWNER)
(define-data-var is-paused bool false)

;; Data Maps
(define-map keepers principal bool)
(define-map pausers principal bool)

;; Events
(define-private (emit-event (event-data {topic: (string-ascii 32)}))
  (print event-data)
)

;; Read-only functions

;; Check if address is admin
(define-read-only (is-admin (address principal))
  (is-eq address (var-get contract-admin))
)

;; Check if address is keeper
(define-read-only (is-keeper (address principal))
  (default-to false (map-get? keepers address))
)

;; Check if address is pauser
(define-read-only (is-pauser (address principal))
  (default-to false (map-get? pausers address))
)

;; Get current admin
(define-read-only (get-admin)
  (var-get contract-admin)
)

;; Check if contract is paused
(define-read-only (is-contract-paused)
  (var-get is-paused)
)

;; Public functions

;; Set new admin (only current admin)
(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (var-set contract-admin new-admin)
    (print {
      topic: "admin-changed",
      old-admin: tx-sender,
      new-admin: new-admin
    })
    (ok new-admin)
  )
)

;; Add keeper (only admin)
(define-public (add-keeper (keeper principal))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (not (is-keeper keeper)) ERR_ALREADY_EXISTS)
    (map-set keepers keeper true)
    (print {
      topic: "keeper-added",
      keeper: keeper,
      by: tx-sender
    })
    (ok keeper)
  )
)

;; Remove keeper (only admin)
(define-public (remove-keeper (keeper principal))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (is-keeper keeper) ERR_NOT_FOUND)
    (map-delete keepers keeper)
    (print {
      topic: "keeper-removed", 
      keeper: keeper,
      by: tx-sender
    })
    (ok keeper)
  )
)

;; Add pauser (only admin)
(define-public (add-pauser (pauser principal))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (not (is-pauser pauser)) ERR_ALREADY_EXISTS)
    (map-set pausers pauser true)
    (print {
      topic: "pauser-added",
      pauser: pauser,
      by: tx-sender
    })
    (ok pauser)
  )
)

;; Remove pauser (only admin)
(define-public (remove-pauser (pauser principal))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (is-pauser pauser) ERR_NOT_FOUND)
    (map-delete pausers pauser)
    (print {
      topic: "pauser-removed",
      pauser: pauser, 
      by: tx-sender
    })
    (ok pauser)
  )
)

;; Set pause state (only admin or pauser)
(define-public (set-paused (paused bool))
  (begin
    (asserts! (or (is-admin tx-sender) (is-pauser tx-sender)) ERR_NOT_AUTHORIZED)
    (var-set is-paused paused)
    (print {
      topic: "pause-state-changed",
      paused: paused,
      by: tx-sender
    })
    (ok paused)
  )
)

;; Emergency pause (only pauser or admin)
(define-public (emergency-pause)
  (set-paused true)
)

;; Unpause (only admin)
(define-public (unpause)
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (set-paused false)
  )
)

;; Helper functions for other contracts

;; Assert not paused
(define-read-only (assert-not-paused)
  (not (var-get is-paused))
)

;; Assert admin
(define-read-only (assert-admin (caller principal))
  (is-admin caller)
)

;; Assert keeper
(define-read-only (assert-keeper (caller principal))
  (is-keeper caller)
)

;; Assert pauser
(define-read-only (assert-pauser (caller principal))  
  (is-pauser caller)
)

;; Batch operations (only admin)

;; Add multiple keepers
(define-public (add-keepers (keepers-list (list 10 principal)))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (ok (map add-keeper-internal keepers-list))
  )
)

;; Add multiple pausers
(define-public (add-pausers (pausers-list (list 10 principal)))
  (begin
    (asserts! (is-admin tx-sender) ERR_NOT_AUTHORIZED)
    (ok (map add-pauser-internal pausers-list))
  )
)

;; Private helper functions
(define-private (add-keeper-internal (keeper principal))
  (map-set keepers keeper true)
)

(define-private (add-pauser-internal (pauser principal))
  (map-set pausers pauser true)
)