import { describe, it, expect } from 'vitest';
import { Cl } from '@stacks/transactions';

describe('Roles Contract Tests', () => {
  it('should have deployer as initial admin', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    let isAdminResult = simnet.callReadOnlyFn('roles', 'is-admin', [Cl.principal(deployer)], deployer);
    let isUser1AdminResult = simnet.callReadOnlyFn('roles', 'is-admin', [Cl.principal(user1)], deployer);
    let getAdminResult = simnet.callReadOnlyFn('roles', 'get-admin', [], deployer);
    
    expect(isAdminResult.result).toBeBool(true);
    expect(isUser1AdminResult.result).toBeBool(false);
    expect(getAdminResult.result).toBePrincipal(deployer);
  });

  it('should allow admin to add and remove keepers', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Initially no keepers
    let initialCheck = simnet.callReadOnlyFn('roles', 'is-keeper', [Cl.principal(user1)], deployer);
    expect(initialCheck.result).toBeBool(false);
    
    // Add keeper
    let addResult = simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(user1)], deployer);
    expect(addResult.result).toBeOk(Cl.principal(user1));
    
    // Check keeper was added
    let checkResult = simnet.callReadOnlyFn('roles', 'is-keeper', [Cl.principal(user1)], deployer);
    expect(checkResult.result).toBeBool(true);
    
    // Remove keeper
    let removeResult = simnet.callPublicFn('roles', 'remove-keeper', [Cl.principal(user1)], deployer);
    expect(removeResult.result).toBeOk(Cl.principal(user1));
    
    // Check keeper was removed
    let finalCheck = simnet.callReadOnlyFn('roles', 'is-keeper', [Cl.principal(user1)], deployer);
    expect(finalCheck.result).toBeBool(false);
  });

  it('should restrict keeper management to admin only', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    const user2 = simnet.getAccounts().get('wallet_2')!;
    
    // Non-admin cannot add keeper
    let failResult = simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(user2)], user1);
    expect(failResult.result).toBeErr(Cl.uint(100)); // ERR_NOT_AUTHORIZED
    
    // Admin adds keeper first
    simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(user2)], deployer);
    
    // Non-admin cannot remove keeper
    let removeFailResult = simnet.callPublicFn('roles', 'remove-keeper', [Cl.principal(user2)], user1);
    expect(removeFailResult.result).toBeErr(Cl.uint(100)); // ERR_NOT_AUTHORIZED
  });

  it('should allow admin to transfer admin role', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Transfer admin to user1
    let transferResult = simnet.callPublicFn('roles', 'set-admin', [Cl.principal(user1)], deployer);
    expect(transferResult.result).toBeOk(Cl.principal(user1));
    
    // Check new admin
    let isUser1AdminResult = simnet.callReadOnlyFn('roles', 'is-admin', [Cl.principal(user1)], deployer);
    let isDeployerAdminResult = simnet.callReadOnlyFn('roles', 'is-admin', [Cl.principal(deployer)], deployer);
    let getAdminResult = simnet.callReadOnlyFn('roles', 'get-admin', [], deployer);
    
    expect(isUser1AdminResult.result).toBeBool(true);
    expect(isDeployerAdminResult.result).toBeBool(false);
    expect(getAdminResult.result).toBePrincipal(user1);
    
    // Old admin cannot manage roles anymore
    let failResult = simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(deployer)], deployer);
    expect(failResult.result).toBeErr(Cl.uint(100)); // ERR_NOT_AUTHORIZED
    
    // New admin can manage roles
    let successResult = simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(deployer)], user1);
    expect(successResult.result).toBeOk(Cl.principal(deployer));
  });

  it('should handle pause functionality correctly', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    
    // Initially not paused
    let initialCheck = simnet.callReadOnlyFn('roles', 'is-contract-paused', [], deployer);
    expect(initialCheck.result).toBeBool(false);
    
    // Admin can pause
    let pauseResult = simnet.callPublicFn('roles', 'set-paused', [Cl.bool(true)], deployer);
    expect(pauseResult.result).toBeOk(Cl.bool(true));
    
    // Check paused state
    let pausedCheck = simnet.callReadOnlyFn('roles', 'is-contract-paused', [], deployer);
    expect(pausedCheck.result).toBeBool(true);
    
    // Admin can unpause
    let unpauseResult = simnet.callPublicFn('roles', 'unpause', [], deployer);
    expect(unpauseResult.result).toBeOk(Cl.bool(false));
    
    // Check unpaused state
    let unpausedCheck = simnet.callReadOnlyFn('roles', 'is-contract-paused', [], deployer);
    expect(unpausedCheck.result).toBeBool(false);
  });

  it('should allow pausers to pause but only admin to unpause', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Add user1 as pauser
    simnet.callPublicFn('roles', 'add-pauser', [Cl.principal(user1)], deployer);
    
    // Check pauser was added
    let checkPauser = simnet.callReadOnlyFn('roles', 'is-pauser', [Cl.principal(user1)], deployer);
    expect(checkPauser.result).toBeBool(true);
    
    // Pauser can pause
    let pauseResult = simnet.callPublicFn('roles', 'set-paused', [Cl.bool(true)], user1);
    expect(pauseResult.result).toBeOk(Cl.bool(true));
    
    // Pauser cannot unpause (only admin can)
    let unpauseResult = simnet.callPublicFn('roles', 'unpause', [], user1);
    expect(unpauseResult.result).toBeErr(Cl.uint(100)); // ERR_NOT_AUTHORIZED
    
    // Admin can unpause
    let adminUnpause = simnet.callPublicFn('roles', 'unpause', [], deployer);
    expect(adminUnpause.result).toBeOk(Cl.bool(false));
  });

  it('should handle emergency pause correctly', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Add pauser
    simnet.callPublicFn('roles', 'add-pauser', [Cl.principal(user1)], deployer);
    
    // Emergency pause by pauser
    let emergencyResult = simnet.callPublicFn('roles', 'emergency-pause', [], user1);
    expect(emergencyResult.result).toBeOk(Cl.bool(true));
    
    // Check paused
    let checkResult = simnet.callReadOnlyFn('roles', 'is-contract-paused', [], deployer);
    expect(checkResult.result).toBeBool(true);
  });

  it('should prevent duplicate keepers and pausers', () => {
    const deployer = simnet.getAccounts().get('deployer')!;
    const user1 = simnet.getAccounts().get('wallet_1')!;
    
    // Add keeper first time - should work
    let firstAdd = simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(user1)], deployer);
    expect(firstAdd.result).toBeOk(Cl.principal(user1));
    
    // Try to add same keeper again - should fail
    let secondAdd = simnet.callPublicFn('roles', 'add-keeper', [Cl.principal(user1)], deployer);
    expect(secondAdd.result).toBeErr(Cl.uint(101)); // ERR_ALREADY_EXISTS
    
    // Same for pausers
    let addPauser = simnet.callPublicFn('roles', 'add-pauser', [Cl.principal(user1)], deployer);
    expect(addPauser.result).toBeOk(Cl.principal(user1));
    
    let duplicatePauser = simnet.callPublicFn('roles', 'add-pauser', [Cl.principal(user1)], deployer);
    expect(duplicatePauser.result).toBeErr(Cl.uint(101)); // ERR_ALREADY_EXISTS
  });
});