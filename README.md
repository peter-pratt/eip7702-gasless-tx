# EIP-7702 Gasless Transactions

This repository is forked from the [QuickNode EIP-7702 Guide Examples](https://github.com/quiknode-labs/qn-guide-examples/tree/main/ethereum/eip-7702) and contains implementations for account abstraction using EIP-7702.

## 🎯 Overview

EIP-7702 introduces account abstraction by allowing Externally Owned Accounts (EOAs) to temporarily delegate their execution to smart contract code. This repository has this functionality through the `BatchCallAndSponsor` contract, which enables:

- **Gasless transactions** sponsored by third parties
- **Batch execution** of multiple calls in a single transaction
- **Signature-based authorization** for enhanced security
- **Replay protection** through nonce management

## 📋 Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) toolkit
- Node.js (for environment variable management)
- Access to EIP-7702 compatible networks

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone <this-repo>
cd gasless-transactions
forge install
```

### 2. Environment Configuration

```bash
cp env.template .env
# Edit .env with your private keys and RPC URLs
```

### 3. Deploy Contract

```bash
# Deploy to Sepolia testnet
sh deploy network --sepolia

# Deploy to Base mainnet
sh deploy network --base

# Deploy to local network
sh deploy network --localhost
```

### 4. Submit Transactions
#### 4.1 On Terminal
```bash
# Terminal 1 if needed inside the foundry folder
cd foundry 
run : ./target/release/anvil --hardfork prague --chain-id 31337

# Terminal 2
cd ..
source .env
# run step 3 Deploy Contract or run below script.
forge script script/DeployBatchCallAndSponsor.s.sol:DeployBatchCallAndSponsor --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvvv
forge build
forge script script/SendSponsoredEIP7702Transaction.s.sol:SendSponsoredEIP7702Transaction --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast -vvvv
forge script script/CheckDelegationStatus.s.sol:CheckDelegationStatus --rpc-url $SEPOLIA_RPC_URL -vvv
forge script script/RemoveDelegation.s.sol:RemoveDelegation --rpc-url $SEPOLIA_RPC_URL -vvv --broadcast
```
#### 4.2 From UI
```bash
# Terminal 1 if needed inside the foundry folder
cd foundry 
run : ./target/release/anvil --hardfork prague --chain-id 31337

# Terminal 2
cd backend
run : npm start

# Terminal 2
cd ui
run : python3 -m http.server 3000
# ui is accessible on port localhost:3000
```

## 🏗️ Contract Architecture

### BatchCallAndSponsor Contract

The main contract (`src/BatchCallAndSponsor.sol`) provides two execution methods:

1. **Signature-based execution**: Any sponsor can submit batched calls with valid signatures
2. **Direct execution**: The account itself can execute calls without signatures

#### Key Features:

- ✅ **Nonce-based replay protection**
- ✅ **ECDSA signature verification**
- ✅ **Batch call execution**
- ✅ **Comprehensive event logging**

## 🌐 Supported Networks

The deployment script supports the following networks:

| Network           | Chain ID | Key         |
| ----------------- | -------- | ----------- |
| Ethereum Mainnet  | 1        | `mainnet`   |
| Sepolia Testnet   | 11155111 | `sepolia`   |
| Polygon Mainnet   | 137      | `polygon`   |
| Base Mainnet      | 8453     | `base`      |
| BSC Mainnet       | 56       | `bsc`       |
| Localhost (Anvil) | 31337    | `localhost` |

## 📁 Project Structure

```
gasless-transactions/
├── src/
│   └── BatchCallAndSponsor.sol      # Main EIP-7702 contract
├── script/
│   ├── DeployBatchCallAndSponsor.s.sol  # Deployment script
│   └── addressBook/                 # Per-chain contract addresses
│       ├── 1.json                   # Ethereum Mainnet addresses
│       ├── 11155111.json            # Sepolia Testnet addresses
│       ├── 137.json                 # Polygon Mainnet addresses
│       ├── 8453.json                # Base Mainnet addresses
│       └── 56.json                  # BSC Mainnet addresses
├── test/                            # Test files
├── deploy                           # Network deployment script
├── env.template                     # Environment variables template
└── foundry.toml                     # Foundry configuration
```

## 🔧 Development Commands

### Build & Test

```bash
forge build                    # Compile contracts
forge test                     # Run tests
forge test -vvv               # Run tests with verbose output
```

### Static Analysis with Slither

```bash
# Run Slither with custom configuration
slither . --config-file .slither.config.json

# Run Slither with default settings
slither .

# Get help with Slither commands
slither --help

# Run Slither and save output to file
slither . --config-file .slither.config.json --json reports/slither-report.json
```

> **Note**: The project includes a `.slither.config.json` file that excludes library dependencies and low-severity findings for cleaner output. Reports are automatically saved to `reports/slither-report.json`.

### Deployment

```bash
sh deploy network --sepolia   # Deploy to Sepolia
sh deploy network --polygon   # Deploy to Polygon
sh deploy network --base      # Deploy to Base
```

### Address Management

The project uses a **per-chain addressBook system** where each network has its own JSON file containing deployed contract addresses:

```bash
# View addresses for specific networks
cat script/addressBook/1.json           # Ethereum Mainnet
cat script/addressBook/11155111.json    # Sepolia Testnet
cat script/addressBook/137.json         # Polygon Mainnet
cat script/addressBook/8453.json        # Base Mainnet
cat script/addressBook/56.json          # BSC Mainnet
```

## 🌟 Key Components

### Environment Variables (.env)

```bash
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://eth-sepolia.alchemyapi.io/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.alchemyapi.io/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.alchemyapi.io/v2/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org
```

### Deployment Features

- ✅ **Automatic network detection** based on chain ID
- ✅ **Per-chain address book management** with separate JSON files
- ✅ **Environment variable loading** from `.env`
- ✅ **Cross-platform compatibility**
- ✅ **Automatic address book updates** after deployment

## 📚 References

- **Original Implementation**: [QuickNode EIP-7702 Guide](https://github.com/quiknode-labs/qn-guide-examples/tree/main/ethereum/eip-7702)
- **EIP-7702 Specification**: [ethereum/EIPs](https://eips.ethereum.org/EIPS/eip-7702)
- **Foundry Documentation**: [book.getfoundry.sh](https://book.getfoundry.sh/)

## ⚠️ Disclaimer

This is an **internal development repository** for educational and testing purposes. The contracts are experimental and should not be used in production without thorough security audits.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
