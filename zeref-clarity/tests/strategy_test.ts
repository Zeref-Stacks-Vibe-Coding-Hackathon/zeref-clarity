import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.4/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "Strategy Registry: Admin can add strategies",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Add strategy
    let block = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1), // chain-id
        types.uint(1), // proto-id  
        types.buff('Ethereum Aave'), // name
        types.some(types.principal(user1.address)), // addr
        types.uint(100000), // min-amount
        types.uint(10000000), // max-amount
        types.uint(50) // fee-bps (0.5%)
      ], deployer.address)
    ]);
    
    assertEquals(block.receipts[0].result, '(ok {chain-id: u1, proto-id: u1})');
    
    // Check strategy was added
    let checkBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'get-strategy', [types.uint(1), types.uint(1)], deployer.address),
      Tx.contractCall('strategy-registry', 'strategy-exists', [types.uint(1), types.uint(1)], deployer.address),
      Tx.contractCall('strategy-registry', 'is-strategy-enabled', [types.uint(1), types.uint(1)], deployer.address)
    ]);
    
    assertEquals(checkBlock.receipts[0].result.includes('Ethereum Aave'), true);
    assertEquals(checkBlock.receipts[1].result, 'true');
    assertEquals(checkBlock.receipts[2].result, 'true');
  },
});

Clarinet.test({
  name: "Strategy Registry: Only admin can manage strategies",  
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;
    
    // Non-admin cannot add strategy
    let block = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1),
        types.uint(1),
        types.buff('Test Strategy'),
        types.none(),
        types.uint(100000),
        types.uint(10000000),
        types.uint(50)
      ], user1.address)
    ]);
    assertEquals(block.receipts[0].result, '(err u100)'); // ERR_NOT_AUTHORIZED
    
    // Admin adds strategy first
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1),
        types.uint(1), 
        types.buff('Test Strategy'),
        types.none(),
        types.uint(100000),
        types.uint(10000000),
        types.uint(50)
      ], deployer.address)
    ]);
    
    // Non-admin cannot disable strategy
    let disableBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'disable-strategy', [types.uint(1), types.uint(1)], user1.address)
    ]);
    assertEquals(disableBlock.receipts[0].result, '(err u100)'); // ERR_NOT_AUTHORIZED
  },
});

Clarinet.test({
  name: "Strategy Registry: Can enable and disable strategies",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add strategy (enabled by default)
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(2),
        types.uint(1),
        types.buff('Polygon Compound'),
        types.none(),
        types.uint(50000),
        types.uint(5000000),
        types.uint(75)
      ], deployer.address)
    ]);
    
    // Check initially enabled
    let initialCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'is-strategy-enabled', [types.uint(2), types.uint(1)], deployer.address)
    ]);
    assertEquals(initialCheck.receipts[0].result, 'true');
    
    // Disable strategy
    let disableBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'disable-strategy', [types.uint(2), types.uint(1)], deployer.address)
    ]);
    assertEquals(disableBlock.receipts[0].result, '(ok true)');
    
    // Check disabled
    let disabledCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'is-strategy-enabled', [types.uint(2), types.uint(1)], deployer.address)
    ]);
    assertEquals(disabledCheck.receipts[0].result, 'false');
    
    // Re-enable strategy
    let enableBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'enable-strategy', [types.uint(2), types.uint(1)], deployer.address)
    ]);
    assertEquals(enableBlock.receipts[0].result, '(ok true)');
    
    // Check enabled again
    let enabledCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'is-strategy-enabled', [types.uint(2), types.uint(1)], deployer.address)
    ]);
    assertEquals(enabledCheck.receipts[0].result, 'true');
  },
});

Clarinet.test({
  name: "Strategy Registry: Validation works correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add strategy with amount limits
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1),
        types.uint(2),
        types.buff('Bitcoin Lightning'),
        types.none(),
        types.uint(1000000), // 1M min
        types.uint(10000000), // 10M max
        types.uint(100)
      ], deployer.address)
    ]);
    
    // Validate with amount too low - should fail
    let lowCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'validate-strategy', [
        types.uint(1), 
        types.uint(2), 
        types.uint(500000) // 0.5M - below min
      ], deployer.address)
    ]);
    assertEquals(lowCheck.receipts[0].result, 'false');
    
    // Validate with amount too high - should fail  
    let highCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'validate-strategy', [
        types.uint(1),
        types.uint(2), 
        types.uint(15000000) // 15M - above max
      ], deployer.address)
    ]);
    assertEquals(highCheck.receipts[0].result, 'false');
    
    // Validate with valid amount - should pass
    let validCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'validate-strategy', [
        types.uint(1),
        types.uint(2),
        types.uint(5000000) // 5M - within range
      ], deployer.address)
    ]);
    assertEquals(validCheck.receipts[0].result, 'true');
    
    // Disable strategy and validate - should fail
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'disable-strategy', [types.uint(1), types.uint(2)], deployer.address)
    ]);
    
    let disabledCheck = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'validate-strategy', [
        types.uint(1),
        types.uint(2),
        types.uint(5000000)
      ], deployer.address)
    ]);
    assertEquals(disabledCheck.receipts[0].result, 'false');
  },
});

Clarinet.test({
  name: "Strategy Registry: Can update strategy parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add strategy
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(3),
        types.uint(1),
        types.buff('Arbitrum Uniswap'),
        types.none(),
        types.uint(100000),
        types.uint(1000000),
        types.uint(25)
      ], deployer.address)
    ]);
    
    // Update parameters
    let updateBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'update-strategy-params', [
        types.uint(3),
        types.uint(1),
        types.uint(200000), // new min
        types.uint(2000000), // new max  
        types.uint(50) // new fee
      ], deployer.address)
    ]);
    assertEquals(updateBlock.receipts[0].result, '(ok true)');
    
    // Check updated parameters via validation
    let validationBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'validate-strategy', [
        types.uint(3),
        types.uint(1),
        types.uint(150000) // Below new min (200k)
      ], deployer.address),
      Tx.contractCall('strategy-registry', 'validate-strategy', [
        types.uint(3), 
        types.uint(1),
        types.uint(1500000) // Within new range
      ], deployer.address)
    ]);
    
    assertEquals(validationBlock.receipts[0].result, 'false'); // Below min
    assertEquals(validationBlock.receipts[1].result, 'true'); // Valid
  },
});

Clarinet.test({
  name: "Strategy Registry: Can set and get metadata",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add strategy first
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(4),
        types.uint(1),
        types.buff('Optimism Balancer'),
        types.none(),
        types.uint(100000),
        types.uint(5000000),
        types.uint(30)
      ], deployer.address)
    ]);
    
    // Set metadata
    let metadataBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'set-strategy-metadata', [
        types.uint(4),
        types.uint(1),
        types.buff('Automated liquidity provision on Balancer V2 pools with dynamic rebalancing'),
        types.buff('https://balancer.fi'),
        types.buff('https://assets.balancer.fi/logo.png'),
        types.uint(3), // Medium risk
        types.uint(850) // 8.5% APR
      ], deployer.address)
    ]);
    assertEquals(metadataBlock.receipts[0].result, '(ok true)');
    
    // Get metadata
    let getMetadata = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'get-strategy-metadata', [types.uint(4), types.uint(1)], deployer.address)
    ]);
    
    // Check metadata contains expected values
    const result = getMetadata.receipts[0].result;
    assertEquals(result.includes('risk-level: u3'), true);
    assertEquals(result.includes('expected-apr-bps: u850'), true);
  },
});

Clarinet.test({
  name: "Strategy Registry: Get strategies by chain works",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add strategies on different chains
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1), types.uint(1), types.buff('Stacks Strategy 1'), types.none(),
        types.uint(100000), types.uint(1000000), types.uint(50)
      ], deployer.address),
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1), types.uint(2), types.buff('Stacks Strategy 2'), types.none(),  
        types.uint(100000), types.uint(1000000), types.uint(50)
      ], deployer.address),
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(2), types.uint(1), types.buff('Ethereum Strategy 1'), types.none(),
        types.uint(100000), types.uint(1000000), types.uint(50)
      ], deployer.address)
    ]);
    
    // Get strategies for chain 1 (Stacks)
    let chain1Block = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'get-strategies-for-chain', [types.uint(1)], deployer.address)
    ]);
    
    // Should return 2 strategies
    const chain1Result = chain1Block.receipts[0].result;
    assertEquals(chain1Result.includes('{chain-id: u1, proto-id: u1}'), true);
    assertEquals(chain1Result.includes('{chain-id: u1, proto-id: u2}'), true);
    
    // Get strategies for chain 2 (Ethereum) 
    let chain2Block = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'get-strategies-for-chain', [types.uint(2)], deployer.address)
    ]);
    
    // Should return 1 strategy
    const chain2Result = chain2Block.receipts[0].result;
    assertEquals(chain2Result.includes('{chain-id: u2, proto-id: u1}'), true);
  },
});

Clarinet.test({
  name: "Strategy Registry: Cannot add duplicate strategies",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Add strategy
    chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(5), types.uint(1), types.buff('Test Strategy'), types.none(),
        types.uint(100000), types.uint(1000000), types.uint(50)
      ], deployer.address)
    ]);
    
    // Try to add same strategy again - should fail
    let duplicateBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(5), types.uint(1), types.buff('Duplicate Strategy'), types.none(),
        types.uint(200000), types.uint(2000000), types.uint(75)
      ], deployer.address)
    ]);
    assertEquals(duplicateBlock.receipts[0].result, '(err u102)'); // ERR_STRATEGY_ALREADY_EXISTS
  },
});

Clarinet.test({
  name: "Strategy Registry: Parameter validation works", 
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    
    // Try to add strategy with invalid chain ID
    let invalidChainBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(0), // Invalid chain ID
        types.uint(1),
        types.buff('Invalid Chain'),
        types.none(),
        types.uint(100000),
        types.uint(1000000),
        types.uint(50)
      ], deployer.address)
    ]);
    assertEquals(invalidChainBlock.receipts[0].result, '(err u104)'); // ERR_INVALID_PARAMETERS
    
    // Try to add strategy with invalid proto ID
    let invalidProtoBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1),
        types.uint(0), // Invalid proto ID
        types.buff('Invalid Proto'),
        types.none(),
        types.uint(100000),
        types.uint(1000000),
        types.uint(50)
      ], deployer.address)
    ]);
    assertEquals(invalidProtoBlock.receipts[0].result, '(err u104)'); // ERR_INVALID_PARAMETERS
    
    // Try to add strategy with fee >= 100%
    let invalidFeeBlock = chain.mineBlock([
      Tx.contractCall('strategy-registry', 'add-strategy', [
        types.uint(1),
        types.uint(1),
        types.buff('Invalid Fee'),
        types.none(),
        types.uint(100000),
        types.uint(1000000),
        types.uint(10000) // 100% fee
      ], deployer.address)
    ]);
    assertEquals(invalidFeeBlock.receipts[0].result, '(err u104)'); // ERR_INVALID_PARAMETERS
  },
});