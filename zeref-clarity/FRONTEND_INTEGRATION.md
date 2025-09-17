# LoopFi Vault - Frontend Integration Guide

## 🚀 Deployed Contracts (Testnet)

All contracts are successfully deployed on Stacks Testnet:

### Contract Addresses
- **Vault**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.vault-v3`
- **ySTX Token**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.ystx-token-v3`
- **Strategy Registry**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.strategy-registry-v3`
- **SIP-010 Trait**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.sip-010-trait-v3`
- **Roles**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.roles-v3`
- **Bridge Adapter Trait**: `ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.bridge-adapter-trait-v3`

### Transaction IDs
- **bridge-adapter-trait-v3**: `7111beccc8d39a849f629fc942bd7be47653bec454fa52ae195cb54a0c3d099f`
- **roles-v3**: `e788cba613171513834b5aa0a792f81c03e6c1d1364312bb6faa9c6ee3994ccc`
- **sip-010-trait-v3**: `58e9ddf66e252eb791e2814174bdb62027a19062e0f976772c45f209981a8121`
- **strategy-registry-v3**: `5b691301eaba3c13501cf5df0c10c7903799d13e000fa810582e5c3d17354319`
- **ystx-token-v3**: `4128e01a0916fde1d937608384ee931309182b45bd54ece6a287fee7919230ab`
- **vault-v3**: `f291332f5f0b7eac516382136640c3302eaa6acbc6b4db987595e94e21d933ed`

## 📋 Prerequisites

### Required Dependencies
```json
{
  "@stacks/connect": "^7.0.0",
  "@stacks/transactions": "^6.0.0",
  "@stacks/network": "^6.0.0",
  "@stacks/auth": "^6.0.0",
  "@stacks/storage": "^6.0.0"
}
```

### Installation
```bash
npm install @stacks/connect @stacks/transactions @stacks/network @stacks/auth @stacks/storage
```

## 🔧 Basic Setup

### 1. Network Configuration
```javascript
import { StacksTestnet } from '@stacks/network';

const network = new StacksTestnet();

// Contract addresses
const CONTRACTS = {
  VAULT: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.vault-v3',
  YSTX_TOKEN: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.ystx-token-v3',
  STRATEGY_REGISTRY: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.strategy-registry-v3',
  ROLES: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS.roles-v3'
};
```

### 2. Wallet Connection
```javascript
import { connect, disconnect } from '@stacks/connect';

const connectWallet = () => {
  connect({
    appDetails: {
      name: 'LoopFi Vault',
      icon: '/logo.png'
    },
    redirectTo: '/',
    onFinish: () => {
      window.location.reload();
    },
    userSession: userSession
  });
};
```

## 💰 Core Integration Functions

### 1. Vault Operations

#### Deposit STX
```javascript
import { 
  makeContractCall, 
  broadcastTransaction, 
  AnchorMode,
  PostConditionMode,
  uintCV
} from '@stacks/transactions';

const depositSTX = async (amount, userSession) => {
  const txOptions = {
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'vault-v3',
    functionName: 'deposit',
    functionArgs: [uintCV(amount)], // Amount in microSTX
    senderKey: userSession.loadUserData().profile.stxAddress,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 200000 // 0.2 STX fee
  };

  const transaction = await makeContractCall(txOptions);
  const result = await broadcastTransaction(transaction, network);
  return result;
};

// Usage
const handleDeposit = async () => {
  const amountInMicroSTX = 1000000; // 1 STX
  try {
    const result = await depositSTX(amountInMicroSTX, userSession);
    console.log('Deposit successful:', result);
  } catch (error) {
    console.error('Deposit failed:', error);
  }
};
```

#### Withdraw STX
```javascript
const withdrawSTX = async (shares, userSession) => {
  const txOptions = {
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'vault-v3',
    functionName: 'withdraw',
    functionArgs: [uintCV(shares)], // Shares to burn
    senderKey: userSession.loadUserData().profile.stxAddress,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 200000
  };

  const transaction = await makeContractCall(txOptions);
  const result = await broadcastTransaction(transaction, network);
  return result;
};
```

### 2. Read-Only Functions

#### Get User Balance
```javascript
import { callReadOnlyFunction, cvToJSON } from '@stacks/transactions';

const getUserBalance = async (userAddress) => {
  const result = await callReadOnlyFunction({
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'vault-v3',
    functionName: 'get-user-balance',
    functionArgs: [standardPrincipalCV(userAddress)],
    network
  });

  return cvToJSON(result);
};
```

#### Get Exchange Rate
```javascript
const getExchangeRate = async () => {
  const result = await callReadOnlyFunction({
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'vault-v3',
    functionName: 'get-exchange-rate',
    functionArgs: [],
    network
  });

  return cvToJSON(result).value;
};
```

#### Preview Deposit/Withdraw
```javascript
const previewDeposit = async (amount) => {
  const result = await callReadOnlyFunction({
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'vault-v3',
    functionName: 'preview-deposit',
    functionArgs: [uintCV(amount)],
    network
  });

  return cvToJSON(result).value;
};

const previewWithdraw = async (shares) => {
  const result = await callReadOnlyFunction({
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'vault-v3',
    functionName: 'preview-withdraw',
    functionArgs: [uintCV(shares)],
    network
  });

  return cvToJSON(result).value;
};
```

### 3. ySTX Token Integration

#### Get Token Balance
```javascript
const getYSTXBalance = async (userAddress) => {
  const result = await callReadOnlyFunction({
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'ystx-token-v3',
    functionName: 'get-balance',
    functionArgs: [standardPrincipalCV(userAddress)],
    network
  });

  return cvToJSON(result).value;
};
```

#### Transfer ySTX
```javascript
const transferYSTX = async (amount, recipient, userSession) => {
  const txOptions = {
    contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
    contractName: 'ystx-token-v3',
    functionName: 'transfer',
    functionArgs: [
      uintCV(amount),
      standardPrincipalCV(userSession.loadUserData().profile.stxAddress),
      standardPrincipalCV(recipient),
      noneCV() // memo
    ],
    senderKey: userSession.loadUserData().profile.stxAddress,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 200000
  };

  const transaction = await makeContractCall(txOptions);
  const result = await broadcastTransaction(transaction, network);
  return result;
};
```

## 📊 Event Monitoring

### Listen to Vault Events
```javascript
import { connectWebSocketClient } from '@stacks/blockchain-api-client';

const monitorVaultEvents = () => {
  const client = connectWebSocketClient('wss://stacks-node-api.testnet.stacks.co/');

  client.subscribeAddressTransactions('ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS', (event) => {
    if (event.tx_result.repr.includes('event-deposit')) {
      console.log('Deposit event detected:', event);
      // Handle deposit event
    }
    
    if (event.tx_result.repr.includes('event-withdraw')) {
      console.log('Withdraw event detected:', event);
      // Handle withdraw event
    }
    
    if (event.tx_result.repr.includes('event-strategy-change-requested')) {
      console.log('Strategy change event detected:', event);
      // Handle strategy change event
    }
  });
};
```

### Parse Event Data
```javascript
const parseVaultEvent = (eventData) => {
  try {
    const parsed = JSON.parse(eventData.tx_result.repr);
    
    switch (parsed.topic) {
      case 'event-deposit':
        return {
          type: 'deposit',
          user: parsed.user,
          amountSTX: parsed['amount-stx'],
          shares: parsed.shares,
          feeBps: parsed['fee-bps']
        };
        
      case 'event-withdraw':
        return {
          type: 'withdraw',
          user: parsed.user,
          shares: parsed.shares,
          amountSTX: parsed['amount-stx'],
          feeBps: parsed['fee-bps']
        };
        
      case 'virtual-yield-updated':
        return {
          type: 'yield-update',
          delta: parsed.delta,
          newTotalUnderlying: parsed['new-total-underlying'],
          by: parsed.by
        };
        
      default:
        return { type: 'unknown', data: parsed };
    }
  } catch (error) {
    console.error('Failed to parse event:', error);
    return null;
  }
};
```

## 🎨 React Integration Example

### Custom Hook
```javascript
import { useState, useEffect } from 'react';

const useVaultData = (userAddress) => {
  const [balance, setBalance] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [totalUnderlying, setTotalUnderlying] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userBalance, rate, underlying] = await Promise.all([
          getUserBalance(userAddress),
          getExchangeRate(),
          callReadOnlyFunction({
            contractAddress: 'ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS',
            contractName: 'vault-v3',
            functionName: 'get-total-underlying',
            functionArgs: [],
            network
          })
        ]);

        setBalance(userBalance);
        setExchangeRate(rate);
        setTotalUnderlying(cvToJSON(underlying).value);
      } catch (error) {
        console.error('Failed to fetch vault data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userAddress) {
      fetchData();
    }
  }, [userAddress]);

  return { balance, exchangeRate, totalUnderlying, loading };
};
```

### Vault Dashboard Component
```jsx
import React, { useState } from 'react';

const VaultDashboard = ({ userSession }) => {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const userAddress = userSession?.loadUserData()?.profile?.stxAddress;
  
  const { balance, exchangeRate, totalUnderlying, loading } = useVaultData(userAddress);

  const handleDeposit = async () => {
    if (!depositAmount) return;
    
    try {
      const amountInMicroSTX = parseFloat(depositAmount) * 1000000;
      await depositSTX(amountInMicroSTX, userSession);
      alert('Deposit successful!');
      setDepositAmount('');
    } catch (error) {
      alert('Deposit failed: ' + error.message);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawShares) return;
    
    try {
      await withdrawSTX(parseInt(withdrawShares), userSession);
      alert('Withdraw successful!');
      setWithdrawShares('');
    } catch (error) {
      alert('Withdraw failed: ' + error.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="vault-dashboard">
      <h2>LoopFi Vault Dashboard</h2>
      
      <div className="stats">
        <div>Exchange Rate: {exchangeRate / 1000000} STX per ySTX</div>
        <div>Total Underlying: {totalUnderlying / 1000000} STX</div>
        <div>Your ySTX Balance: {balance?.shares || 0}</div>
        <div>Estimated Value: {balance?.['est-amount'] / 1000000 || 0} STX</div>
      </div>

      <div className="deposit-section">
        <h3>Deposit STX</h3>
        <input
          type="number"
          placeholder="Amount in STX"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
        />
        <button onClick={handleDeposit}>Deposit</button>
      </div>

      <div className="withdraw-section">
        <h3>Withdraw STX</h3>
        <input
          type="number"
          placeholder="Shares to burn"
          value={withdrawShares}
          onChange={(e) => setWithdrawShares(e.target.value)}
        />
        <button onClick={handleWithdraw}>Withdraw</button>
      </div>
    </div>
  );
};
```

## 🔐 Security Considerations

### 1. Post Conditions
Always add post conditions for sensitive operations:

```javascript
import { makeStandardSTXPostCondition, FungibleConditionCode } from '@stacks/transactions';

const depositWithPostConditions = async (amount, userSession) => {
  const postConditions = [
    makeStandardSTXPostCondition(
      userSession.loadUserData().profile.stxAddress,
      FungibleConditionCode.Equal,
      amount
    )
  ];

  const txOptions = {
    // ... other options
    postConditions,
    postConditionMode: PostConditionMode.Deny
  };

  // ... rest of transaction
};
```

### 2. Input Validation
```javascript
const validateDepositAmount = (amount) => {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid amount');
  }
  
  if (numAmount < 0.000001) { // 1 microSTX minimum
    throw new Error('Amount too small');
  }
  
  if (numAmount > 1000000) { // 1M STX maximum
    throw new Error('Amount too large');
  }
  
  return Math.floor(numAmount * 1000000); // Convert to microSTX
};
```

### 3. Error Handling
```javascript
const handleContractError = (error) => {
  if (error.message.includes('u100')) {
    return 'Contract is paused';
  } else if (error.message.includes('u101')) {
    return 'Insufficient funds in vault';
  } else if (error.message.includes('u109')) {
    return 'Amount cannot be zero';
  } else if (error.message.includes('u110')) {
    return 'Shares cannot be zero';
  }
  
  return 'Transaction failed: ' + error.message;
};
```

## 📱 Mobile Integration

### React Native Setup
```javascript
import { AppConfig, UserSession } from '@stacks/auth';
import { StacksTestnet } from '@stacks/network';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });
const network = new StacksTestnet();

// Use same contract interaction functions as web
```

## 🧪 Testing

### Unit Tests
```javascript
describe('Vault Integration', () => {
  test('should calculate correct shares for deposit', async () => {
    const amount = 1000000; // 1 STX
    const expectedShares = await previewDeposit(amount);
    expect(expectedShares).toBeGreaterThan(0);
  });

  test('should get user balance correctly', async () => {
    const userAddress = 'ST1TESTADDRESS...';
    const balance = await getUserBalance(userAddress);
    expect(balance).toHaveProperty('shares');
    expect(balance).toHaveProperty('est-amount');
  });
});
```

## 📚 Additional Resources

### Useful Links
- [Stacks Documentation](https://docs.stacks.co/)
- [Stacks.js Documentation](https://docs.stacks.co/docs/stacks.js/)
- [Testnet Explorer](https://explorer.stacks.co/?chain=testnet)
- [Contract Explorer](https://explorer.stacks.co/address/ST3QYJZBWBZAJA69WSJDGMHRQ4FAGPY9QH15TJJJS?chain=testnet)

### Error Reference
| Error Code | Constant | Description |
|------------|----------|-------------|
| u100 | ERR_PAUSED | Contract is paused |
| u101 | ERR_NO_FUNDS | Insufficient vault funds |
| u102 | ERR_BAD_SHARES | Invalid shares amount |
| u103 | ERR_NOT_KEEPER | Not authorized keeper |
| u104 | ERR_NOT_ADMIN | Not authorized admin |
| u105 | ERR_CAP_EXCEEDED | TVL cap exceeded |
| u106 | ERR_STRATEGY_NOT_ALLOWED | Strategy not allowlisted |
| u109 | ERR_ZERO_AMOUNT | Amount cannot be zero |
| u110 | ERR_ZERO_SHARES | Shares cannot be zero |

---

**Happy Building! 🚀**

For questions or support, please refer to the main README.md or create an issue in the repository.