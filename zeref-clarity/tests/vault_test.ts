import { describe, it, expect, beforeEach } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('Vault Contract Tests', () => {
  it('should create 1:1 shares for first deposit', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Setup: set vault contract in ystx-token
    let setupResult = simnet.callPublicFn(
      'ystx-token',
      'set-vault-contract',
      [Cl.principal(deployer + '.vault')],
      deployer
    );
    expect(setupResult.result).toBeOk(Cl.bool(true));
    
    // First deposit
    let depositResult = simnet.callPublicFn(
      'vault',
      'deposit',
      [Cl.uint(1000000)],
      user1
    );
    
    expect(depositResult.result).toBeOk(Cl.uint(1000000)); // 1:1 ratio for first deposit
    
    // Check vault state
    let underlyingResult = simnet.callReadOnlyFn('vault', 'get-total-underlying', [], deployer);
    let sharesResult = simnet.callReadOnlyFn('vault', 'get-total-shares', [], deployer);
    let balanceResult = simnet.callReadOnlyFn('ystx-token', 'get-balance', [Cl.principal(user1)], deployer);
    
    expect(underlyingResult.result).toBeUint(1000000);
    expect(sharesResult.result).toBeUint(1000000);
    expect(balanceResult.result).toBeOk(Cl.uint(1000000));
  });
});

Clarinet.test({
  name: "Vault: Second deposit calculates pro-rata shares",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    const user2 = accounts.get('wallet_2')!;
    
    // Setup
    chain.mineBlock([
      Tx.contractCall('ystx-token', 'set-vault-contract', [types.principal(deployer.address + '.vault')], deployer.address)
    ]);
    
    // First deposit: 1000000 STX -> 1000000 shares
    chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(1000000)], user1.address)
    ]);
    
    // Simulate yield increase
    chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(deployer.address)], deployer.address),
      Tx.contractCall('vault', 'update-virtual-yield', [types.int(500000)], deployer.address) // 50% yield
    ]);
    
    // Second deposit: 1000000 STX when total underlying = 1500000, total shares = 1000000
    // Expected shares = 1000000 * 1000000 / 1500000 = 666666
    let block = chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(1000000)], user2.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok u666666)');
    
    // Check final state
    let stateBlock = chain.mineBlock([
      Tx.contractCall('vault', 'get-total-underlying', [], deployer.address),
      Tx.contractCall('vault', 'get-total-shares', [], deployer.address)
    ]);
    
    assertEquals(stateBlock.receipts[0].result, 'u2500000'); // 1500000 + 1000000
    assertEquals(stateBlock.receipts[1].result, 'u1666666'); // 1000000 + 666666
  },
});

Clarinet.test({
  name: "Vault: Withdraw burns shares and returns STX",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Setup and deposit
    chain.mineBlock([
      Tx.contractCall('ystx-token', 'set-vault-contract', [types.principal(deployer.address + '.vault')], deployer.address),
      Tx.contractCall('vault', 'deposit', [types.uint(1000000)], user1.address)
    ]);
    
    // Add yield
    chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(deployer.address)], deployer.address),
      Tx.contractCall('vault', 'update-virtual-yield', [types.int(500000)], deployer.address)
    ]);
    
    // Withdraw half shares (500000 shares)
    // Expected amount = 500000 * 1500000 / 1000000 = 750000 STX
    let block = chain.mineBlock([
      Tx.contractCall('vault', 'withdraw', [types.uint(500000)], user1.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok u750000)');
    
    // Check remaining state
    let stateBlock = chain.mineBlock([
      Tx.contractCall('vault', 'get-total-underlying', [], deployer.address),
      Tx.contractCall('vault', 'get-total-shares', [], deployer.address),
      Tx.contractCall('ystx-token', 'get-balance', [types.principal(user1.address)], deployer.address)
    ]);
    
    assertEquals(stateBlock.receipts[0].result, 'u750000'); // 1500000 - 750000
    assertEquals(stateBlock.receipts[1].result, 'u500000'); // 1000000 - 500000  
    assertEquals(stateBlock.receipts[2].result, '(ok u500000)');
  },
});

Clarinet.test({
  name: "Vault: Pause blocks deposit and withdraw",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Setup
    chain.mineBlock([
      Tx.contractCall('ystx-token', 'set-vault-contract', [types.principal(deployer.address + '.vault')], deployer.address),
      Tx.contractCall('vault', 'deposit', [types.uint(1000000)], user1.address)
    ]);
    
    // Pause contract
    let pauseBlock = chain.mineBlock([
      Tx.contractCall('roles', 'set-paused', [types.bool(true)], deployer.address)
    ]);
    assertEquals(pauseBlock.receipts[0].result, '(ok true)');
    
    // Try deposit while paused - should fail
    let depositBlock = chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(500000)], user1.address)
    ]);
    assertEquals(depositBlock.receipts[0].result, '(err u100)'); // ERR_PAUSED
    
    // Try withdraw while paused - should fail
    let withdrawBlock = chain.mineBlock([
      Tx.contractCall('vault', 'withdraw', [types.uint(500000)], user1.address)
    ]);
    assertEquals(withdrawBlock.receipts[0].result, '(err u100)'); // ERR_PAUSED
    
    // Unpause
    chain.mineBlock([
      Tx.contractCall('roles', 'set-paused', [types.bool(false)], deployer.address)
    ]);
    
    // Now deposit should work
    let workingBlock = chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(500000)], user1.address)
    ]);
    assertEquals(workingBlock.receipts[0].result.startsWith('(ok u'), true);
  },
});

Clarinet.test({
  name: "Vault: Only keeper can update virtual yield",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Try to update yield without being keeper - should fail
    let block = chain.mineBlock([
      Tx.contractCall('vault', 'update-virtual-yield', [types.int(100000)], user1.address)
    ]);
    assertEquals(block.receipts[0].result, '(err u103)'); // ERR_NOT_KEEPER
    
    // Add user1 as keeper
    chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(user1.address)], deployer.address)
    ]);
    
    // Now should work
    let successBlock = chain.mineBlock([
      Tx.contractCall('vault', 'update-virtual-yield', [types.int(100000)], user1.address)
    ]);
    assertEquals(successBlock.receipts[0].result, '(ok u100000)');
  },
});

Clarinet.test({
  name: "Vault: Only admin can set fees and cap",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Try to set deposit fee without being admin - should fail
    let block = chain.mineBlock([
      Tx.contractCall('vault', 'set-deposit-fee', [types.uint(100)], user1.address)
    ]);
    assertEquals(block.receipts[0].result, '(err u104)'); // ERR_NOT_ADMIN
    
    // Admin should be able to set fees
    let adminBlock = chain.mineBlock([
      Tx.contractCall('vault', 'set-deposit-fee', [types.uint(100)], deployer.address), // 1% fee
      Tx.contractCall('vault', 'set-withdraw-fee', [types.uint(50)], deployer.address), // 0.5% fee
      Tx.contractCall('vault', 'set-cap', [types.some(types.uint(10000000))], deployer.address) // 10M STX cap
    ]);
    
    assertEquals(adminBlock.receipts[0].result, '(ok u100)');
    assertEquals(adminBlock.receipts[1].result, '(ok u50)');
    assertEquals(adminBlock.receipts[2].result, '(ok (some u10000000))');
    
    // Check fees are applied
    let feesBlock = chain.mineBlock([
      Tx.contractCall('vault', 'get-fees', [], deployer.address)
    ]);
    
    assertEquals(feesBlock.receipts[0].result, '{deposit-fee-bps: u100, withdraw-fee-bps: u50}');
  },
});

Clarinet.test({
  name: "Vault: Strategy change request validates allowlist",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add keeper
    chain.mineBlock([
      Tx.contractCall('roles', 'add-keeper', [types.principal(deployer.address)], deployer.address)
    ]);
    
    // Try strategy change without adding strategy - should fail
    let block = chain.mineBlock([
      Tx.contractCall('vault', 'request-strategy-change', [
        types.uint(1), // from-chain
        types.uint(1), // from-proto  
        types.uint(2), // to-chain
        types.uint(1), // to-proto
        types.uint(1000000), // amount
        types.uint(1) // reason-code
      ], deployer.address)
    ]);
    assertEquals(block.receipts[0].result, '(err u106)'); // ERR_STRATEGY_NOT_ALLOWED
    
    // Add strategy to registry
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(2), // chain-id
        types.uint(1), // proto-id
        types.buff('Ethereum Compound'), // name
        types.none(), // addr
        types.uint(100000), // min-amount
        types.uint(10000000), // max-amount  
        types.uint(50) // fee-bps
      ], deployer.address)
    ]);
    
    // Now should work
    let successBlock = chain.mineBlock([
      Tx.contractCall('vault', 'request-strategy-change', [
        types.uint(1),
        types.uint(1),
        types.uint(2),
        types.uint(1),
        types.uint(1000000),
        types.uint(1)
      ], deployer.address)
    ]);
    assertEquals(successBlock.receipts[0].result, '(ok true)');
  },
});

Clarinet.test({
  name: "Vault: Cap blocks excess deposits",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Setup with cap
    chain.mineBlock([
      Tx.contractCall('ystx-token', 'set-vault-contract', [types.principal(deployer.address + '.vault')], deployer.address),
      Tx.contractCall('vault', 'set-cap', [types.some(types.uint(1500000))], deployer.address) // 1.5M STX cap
    ]);
    
    // First deposit should work
    chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(1000000)], user1.address)
    ]);
    
    // Second deposit that exceeds cap should fail
    let block = chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(600000)], user1.address) // Would make total 1.6M
    ]);
    assertEquals(block.receipts[0].result, '(err u105)'); // ERR_CAP_EXCEEDED
    
    // Smaller deposit within cap should work
    let successBlock = chain.mineBlock([
      Tx.contractCall('vault', 'deposit', [types.uint(400000)], user1.address) // Total = 1.4M
    ]);
    assertEquals(successBlock.receipts[0].result.startsWith('(ok u'), true);
  },
});

Clarinet.test({
  name: "Vault: Exchange rate reflects yield correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Setup and initial deposit
    chain.mineBlock([
      Tx.contractCall('ystx-token', 'set-vault-contract', [types.principal(deployer.address + '.vault')], deployer.address),
      Tx.contractCall('vault', 'deposit', [types.uint(1000000)], user1.address),
      Tx.contractCall('roles', 'add-keeper', [types.principal(deployer.address)], deployer.address)
    ]);
    
    // Initial exchange rate should be 1:1 (1000000 precision)
    let initialRate = chain.mineBlock([
      Tx.contractCall('vault', 'get-exchange-rate', [], deployer.address)
    ]);
    assertEquals(initialRate.receipts[0].result, 'u1000000'); // 1.0 * 1M precision
    
    // Add 50% yield
    chain.mineBlock([
      Tx.contractCall('vault', 'update-virtual-yield', [types.int(500000)], deployer.address)
    ]);
    
    // Exchange rate should be 1.5 (1500000 precision)
    let newRate = chain.mineBlock([
      Tx.contractCall('vault', 'get-exchange-rate', [], deployer.address)
    ]);
    assertEquals(newRate.receipts[0].result, 'u1500000'); // 1.5 * 1M precision
    
    // Preview withdraw should reflect new rate
    let preview = chain.mineBlock([
      Tx.contractCall('vault', 'preview-withdraw', [types.uint(500000)], deployer.address) // Half shares
    ]);
    assertEquals(preview.receipts[0].result, 'u750000'); // Should get 750K STX (1.5 rate)
  },
});