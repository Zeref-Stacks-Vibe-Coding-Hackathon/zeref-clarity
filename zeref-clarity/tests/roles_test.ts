import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "Roles: Deployer is initial admin",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    let block = chain.mineBlock([
      Tx.contractCall('roles', 'is-admin', [types.principal(deployer.address)], deployer.address),
      Tx.contractCall('roles', 'is-admin', [types.principal(user1.address)], deployer.address),
      Tx.contractCall('roles', 'get-admin', [], deployer.address)
    ]);
    
    assertEquals(block.receipts[0].result, 'true');
    assertEquals(block.receipts[1].result, 'false');
    assertEquals(block.receipts[2].result, deployer.address);
  },
});

Clarinet.test({
  name: "Roles: Admin can add and remove keepers",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    // Initially no keepers
    let initialCheck = chain.mineBlock([
      Tx.contractCall('roles', 'is-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(initialCheck.receipts[0].result, 'false');
    
    // Add keeper
    let addBlock = chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(addBlock.receipts[0].result, `(ok ${user1.address})`);
    
    // Check keeper was added
    let checkBlock = chain.mineBlock([
      Tx.contractCall('roles', 'is-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(checkBlock.receipts[0].result, 'true');
    
    // Remove keeper
    let removeBlock = chain.mineBlock([
      Tx.contractCall('roles', 'remove-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(removeBlock.receipts[0].result, `(ok ${user1.address})`);
    
    // Check keeper was removed
    let finalCheck = chain.mineBlock([
      Tx.contractCall('roles', 'is-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(finalCheck.receipts[0].result, 'false');
  },
});

Clarinet.test({
  name: "Roles: Only admin can manage keepers",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    const user2 = accounts.get('wallet_2')!;
    
    // Non-admin cannot add keeper
    let block = chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(user2.address)], user1.address)
    ]);
    assertEquals(block.receipts[0].result, '(err u100)'); // ERR_NOT_AUTHORIZED
    
    // Non-admin cannot remove keeper (first add one)
    chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(user2.address)], deployer.address)
    ]);
    
    let removeBlock = chain.mineBlock([
      Tx.contractCall('roles', 'remove-keeper', [types.principal(user2.address)], user1.address)
    ]);
    assertEquals(removeBlock.receipts[0].result, '(err u100)'); // ERR_NOT_AUTHORIZED
  },
});

Clarinet.test({
  name: "Roles: Admin can transfer admin role",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Transfer admin to user1
    let transferBlock = chain.mineBlock([
      Tx.contractCall('roles', 'set-admin', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(transferBlock.receipts[0].result, user1.address);
    
    // Check new admin
    let checkBlock = chain.mineBlock([
      Tx.contractCall('roles', 'is-admin', [types.principal(user1.address)], deployer.address),
      Tx.contractCall('roles', 'is-admin', [types.principal(deployer.address)], deployer.address),
      Tx.contractCall('roles', 'get-admin', [], deployer.address)
    ]);
    
    assertEquals(checkBlock.receipts[0].result, 'true');
    assertEquals(checkBlock.receipts[1].result, 'false');
    assertEquals(checkBlock.receipts[2].result, user1.address);
    
    // Old admin cannot manage roles anymore
    let failBlock = chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(deployer.address)], deployer.address)
    ]);
    assertEquals(failBlock.receipts[0].result, '(err u100)'); // ERR_NOT_AUTHORIZED
    
    // New admin can manage roles
    let successBlock = chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(deployer.address)], user1.address)
    ]);
    assertEquals(successBlock.receipts[0].result, `(ok ${deployer.address})`);
  },
});

Clarinet.test({
  name: "Roles: Pause functionality works correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Initially not paused
    let initialCheck = chain.mineBlock([
      Tx.contractCall('roles', 'is-contract-paused', [], deployer.address)
    ]);
    assertEquals(initialCheck.receipts[0].result, 'false');
    
    // Admin can pause
    let pauseBlock = chain.mineBlock([
      Tx.contractCall('roles', 'set-paused', [types.bool(true)], deployer.address)
    ]);
    assertEquals(pauseBlock.receipts[0].result, '(ok true)');
    
    // Check paused state
    let pausedCheck = chain.mineBlock([
      Tx.contractCall('roles', 'is-contract-paused', [], deployer.address)
    ]);
    assertEquals(pausedCheck.receipts[0].result, 'true');
    
    // Admin can unpause
    let unpauseBlock = chain.mineBlock([
      Tx.contractCall('roles', 'unpause', [], deployer.address)
    ]);
    assertEquals(unpauseBlock.receipts[0].result, '(ok false)');
    
    // Check unpaused state
    let unpausedCheck = chain.mineBlock([
      Tx.contractCall('roles', 'is-contract-paused', [], deployer.address)
    ]);
    assertEquals(unpausedCheck.receipts[0].result, 'false');
  },
});

Clarinet.test({
  name: "Roles: Pausers can pause but only admin can unpause",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Add user1 as pauser
    chain.mineBlock([
      Tx.contractCall('roles', 'add-pauser', [types.principal(user1.address)], deployer.address)
    ]);
    
    // Check pauser was added
    let checkPauser = chain.mineBlock([
      Tx.contractCall('roles', 'is-pauser', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(checkPauser.receipts[0].result, 'true');
    
    // Pauser can pause
    let pauseBlock = chain.mineBlock([
      Tx.contractCall('roles', 'set-paused', [types.bool(true)], user1.address)
    ]);
    assertEquals(pauseBlock.receipts[0].result, '(ok true)');
    
    // Pauser cannot unpause (only admin can)
    let unpauseBlock = chain.mineBlock([
      Tx.contractCall('roles', 'unpause', [], user1.address)
    ]);
    assertEquals(unpauseBlock.receipts[0].result, '(err u100)'); // ERR_NOT_AUTHORIZED
    
    // Admin can unpause
    let adminUnpause = chain.mineBlock([
      Tx.contractCall('roles', 'unpause', [], deployer.address)
    ]);
    assertEquals(adminUnpause.receipts[0].result, '(ok false)');
  },
});

Clarinet.test({
  name: "Roles: Emergency pause works",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Add pauser
    chain.mineBlock([
      Tx.contractCall('roles', 'add-pauser', [types.principal(user1.address)], deployer.address)
    ]);
    
    // Emergency pause by pauser
    let emergencyBlock = chain.mineBlock([
      Tx.contractCall('roles', 'emergency-pause', [], user1.address)
    ]);
    assertEquals(emergencyBlock.receipts[0].result, '(ok true)');
    
    // Check paused
    let checkBlock = chain.mineBlock([
      Tx.contractCall('roles', 'is-contract-paused', [], deployer.address)
    ]);
    assertEquals(checkBlock.receipts[0].result, 'true');
  },
});

Clarinet.test({
  name: "Roles: Cannot add duplicate keepers or pausers",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Add keeper first time - should work
    let firstAdd = chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(firstAdd.receipts[0].result, `(ok ${user1.address})`);
    
    // Try to add same keeper again - should fail
    let secondAdd = chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(secondAdd.receipts[0].result, '(err u101)'); // ERR_ALREADY_EXISTS
    
    // Same for pausers
    let addPauser = chain.mineBlock([
      Tx.contractCall('roles', 'add-pauser', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(addPauser.receipts[0].result, `(ok ${user1.address})`);
    
    let duplicatePauser = chain.mineBlock([
      Tx.contractCall('roles', 'add-pauser', [types.principal(user1.address)], deployer.address)
    ]);
    assertEquals(duplicatePauser.receipts[0].result, '(err u101)'); // ERR_ALREADY_EXISTS
  },
});

Clarinet.test({
  name: "Roles: Batch operations work correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    const user2 = accounts.get('wallet_2')!;
    const user3 = accounts.get('wallet_3')!;
    
    // Add multiple keepers in one call
    let batchKeepers = chain.mineBlock([
      Tx.contractCall('roles', 'add-keepers', [
        types.list([
          types.principal(user1.address),
          types.principal(user2.address),
          types.principal(user3.address)
        ])
      ], deployer.address)
    ]);
    assertEquals(batchKeepers.receipts[0].result.startsWith('(ok '), true);
    
    // Check all keepers were added
    let checkKeepers = chain.mineBlock([
      Tx.contractCall('roles', 'is-keeper', [types.principal(user1.address)], deployer.address),
      Tx.contractCall('roles', 'is-keeper', [types.principal(user2.address)], deployer.address),
      Tx.contractCall('roles', 'is-keeper', [types.principal(user3.address)], deployer.address)
    ]);
    
    assertEquals(checkKeepers.receipts[0].result, 'true');
    assertEquals(checkKeepers.receipts[1].result, 'true');
    assertEquals(checkKeepers.receipts[2].result, 'true');
    
    // Add multiple pausers in one call
    let batchPausers = chain.mineBlock([
      Tx.contractCall('roles', 'add-pausers', [
        types.list([
          types.principal(user1.address),
          types.principal(user2.address)
        ])
      ], deployer.address)
    ]);
    assertEquals(batchPausers.receipts[0].result.startsWith('(ok '), true);
    
    // Check pausers were added
    let checkPausers = chain.mineBlock([
      Tx.contractCall('roles', 'is-pauser', [types.principal(user1.address)], deployer.address),
      Tx.contractCall('roles', 'is-pauser', [types.principal(user2.address)], deployer.address)
    ]);
    
    assertEquals(checkPausers.receipts[0].result, 'true');
    assertEquals(checkPausers.receipts[1].result, 'true');
  },
});