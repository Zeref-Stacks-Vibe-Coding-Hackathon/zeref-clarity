import { describe, it, expect } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('Vault Contract Tests', () => {
  it('should create 1:1 shares for first deposit', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Setup: set vault contract in ystx-token
    let setupResult = simnet.callPublicFn(
      'ystx-token',
      'set-vault-contract',
      [Cl.principal(`${deployer}.vault`)],
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

  it('should calculate pro-rata shares for second deposit', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    const user2 = simnet.getAccounts().get('wallet_2')!;
    
    // Setup
    simnet.callPublicFn(
      'ystx-token',
      'set-vault-contract', 
      [Cl.principal(`${deployer}.vault`)],
      deployer
    );
    
    // First deposit: 1000000 STX -> 1000000 shares
    simnet.callPublicFn('vault', 'deposit', [Cl.uint(1000000)], user1);
    
    // Simulate yield increase - add keeper first
    simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(deployer)], deployer);
    simnet.callPublicFn('vault', 'update-virtual-yield', [Cl.int(500000)], deployer); // 50% yield
    
    // Second deposit: 1000000 STX when total underlying = 1500000, total shares = 1000000
    // Expected shares = 1000000 * 1000000 / 1500000 = 666666
    let depositResult = simnet.callPublicFn('vault', 'deposit', [Cl.uint(1000000)], user2);
    
    expect(depositResult.result).toBeOk(Cl.uint(666666));
    
    // Check final state
    let underlyingResult = simnet.callReadOnlyFn('vault', 'get-total-underlying', [], deployer);
    let sharesResult = simnet.callReadOnlyFn('vault', 'get-total-shares', [], deployer);
    
    expect(underlyingResult.result).toBeUint(2500000); // 1500000 + 1000000
    expect(sharesResult.result).toBeUint(1666666); // 1000000 + 666666
  });

  it('should allow withdrawal with yield reflection', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Setup and deposit
    simnet.callPublicFn('ystx-token', 'set-vault-contract', [Cl.principal(`${deployer}.vault`)], deployer);
    simnet.callPublicFn('vault', 'deposit', [Cl.uint(1000000)], user1);
    
    // Add yield
    simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(deployer)], deployer);
    simnet.callPublicFn('vault', 'update-virtual-yield', [Cl.int(500000)], deployer);
    
    // Withdraw half shares (500000 shares)
    // Expected amount = 500000 * 1500000 / 1000000 = 750000 STX
    let withdrawResult = simnet.callPublicFn('vault', 'withdraw', [Cl.uint(500000)], user1);
    
    expect(withdrawResult.result).toBeOk(Cl.uint(750000));
    
    // Check remaining state
    let underlyingResult = simnet.callReadOnlyFn('vault', 'get-total-underlying', [], deployer);
    let sharesResult = simnet.callReadOnlyFn('vault', 'get-total-shares', [], deployer);
    let balanceResult = simnet.callReadOnlyFn('ystx-token', 'get-balance', [Cl.principal(user1)], deployer);
    
    expect(underlyingResult.result).toBeUint(750000); // 1500000 - 750000
    expect(sharesResult.result).toBeUint(500000); // 1000000 - 500000  
    expect(balanceResult.result).toBeOk(Cl.uint(500000));
  });

  it('should block operations when paused', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Setup
    simnet.callPublicFn('ystx-token', 'set-vault-contract', [Cl.principal(`${deployer}.vault`)], deployer);
    simnet.callPublicFn('vault', 'deposit', [Cl.uint(1000000)], user1);
    
    // Pause contract
    let pauseResult = simnet.callPublicFn('roles', 'set-paused', [Cl.bool(true)], deployer);
    expect(pauseResult.result).toBeOk(Cl.bool(true));
    
    // Try deposit while paused - should fail
    let depositResult = simnet.callPublicFn('vault', 'deposit', [Cl.uint(500000)], user1);
    expect(depositResult.result).toBeErr(Cl.uint(100)); // ERR_PAUSED
    
    // Try withdraw while paused - should fail  
    let withdrawResult = simnet.callPublicFn('vault', 'withdraw', [Cl.uint(500000)], user1);
    expect(withdrawResult.result).toBeErr(Cl.uint(100)); // ERR_PAUSED
    
    // Unpause
    simnet.callPublicFn('roles', 'set-paused', [Cl.bool(false)], deployer);
    
    // Now deposit should work
    let workingResult = simnet.callPublicFn('vault', 'deposit', [Cl.uint(500000)], user1);
    expect(workingResult.result).toBeOk();
  });

  it('should enforce keeper permissions for yield updates', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Try to update yield without being keeper - should fail
    let failResult = simnet.callPublicFn('vault', 'update-virtual-yield', [Cl.int(100000)], user1);
    expect(failResult.result).toBeErr(Cl.uint(103)); // ERR_NOT_KEEPER
    
    // Add user1 as keeper
    simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(user1)], deployer);
    
    // Now should work
    let successResult = simnet.callPublicFn('vault', 'update-virtual-yield', [Cl.int(100000)], user1);
    expect(successResult.result).toBeOk(Cl.uint(100000));
  });

  it('should enforce admin permissions for fee setting', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Try to set deposit fee without being admin - should fail
    let failResult = simnet.callPublicFn('vault', 'set-deposit-fee', [Cl.uint(100)], user1);
    expect(failResult.result).toBeErr(Cl.uint(104)); // ERR_NOT_ADMIN
    
    // Admin should be able to set fees
    let feeResult = simnet.callPublicFn('vault', 'set-deposit-fee', [Cl.uint(100)], deployer); // 1% fee
    let withdrawFeeResult = simnet.callPublicFn('vault', 'set-withdraw-fee', [Cl.uint(50)], deployer); // 0.5% fee
    let capResult = simnet.callPublicFn('vault', 'set-cap', [Cl.some(Cl.uint(10000000))], deployer); // 10M STX cap
    
    expect(feeResult.result).toBeOk(Cl.uint(100));
    expect(withdrawFeeResult.result).toBeOk(Cl.uint(50));
    expect(capResult.result).toBeOk(Cl.some(Cl.uint(10000000)));
    
    // Check fees are applied
    let feesResult = simnet.callReadOnlyFn('vault', 'get-fees', [], deployer);
    expect(feesResult.result).toBeTuple({
      'deposit-fee-bps': Cl.uint(100), 
      'withdraw-fee-bps': Cl.uint(50)
    });
  });
});