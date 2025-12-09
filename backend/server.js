/**
 * EIP-7702 Backend API Server
 * Executes Foundry scripts for delegation operations
 */

const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Get project root (one level up from backend)
const PROJECT_ROOT = path.join(__dirname, '..');

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

/**
 * Extract transaction hash from Foundry broadcast JSON
 */
function extractTxHashFromBroadcast(scriptName) {
    try {
        // Path to the latest broadcast file
        const baseScriptName = scriptName.split(':')[0];
        
        const broadcastPath = path.join(
            PROJECT_ROOT,
            'broadcast',
            baseScriptName,
            '11155111',
            'run-latest.json'
        );

        console.log('📁 Looking for broadcast file :', broadcastPath);

        if (!fs.existsSync(broadcastPath)) {
            console.warn('⚠️ Broadcast file not found');
            return null;
        }

        const broadcastData = JSON.parse(fs.readFileSync(broadcastPath, 'utf8'));
        
        // Extract transaction hash from the transactions array
        if (broadcastData.transactions && broadcastData.transactions.length > 0) {
            // Get the last transaction (usually the main one)
            const lastTx = broadcastData.transactions[broadcastData.transactions.length - 1];
            if (lastTx.hash) {
                console.log('✅ Extracted tx hash from broadcast:', lastTx.hash);
                return lastTx.hash;
            }
        }

        console.warn('⚠️ No transaction hash found in broadcast data');
        return null;
    } catch (error) {
        console.error('❌ Error reading broadcast file:', error.message);
        return null;
    }
}

/**
 * Execute Foundry script with proper environment
 */
function executeFoundryScript(scriptName, privateKey, additionalEnv = {}) {
    return new Promise((resolve, reject) => {
        // Build the forge command with --skip-simulation to avoid interactive prompts
        const command = `forge script script/${scriptName} --rpc-url $SEPOLIA_RPC_URL --private-key ${privateKey} --broadcast --skip-simulation -vvv`;

        console.log(`\n📝 Executing: ${scriptName}`);
        console.log(`📂 Working directory: ${PROJECT_ROOT}`);

        // Set up environment variables
        const env = {
            ...process.env,
            PRIVATE_KEY: privateKey,
            ...additionalEnv
        };

        // Execute the command
        exec(command, {
            cwd: PROJECT_ROOT,
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            env: env
        }, (error, stdout, stderr) => {
            // Log output
            console.log('\n📤 STDOUT:', stdout);
            if (stderr) console.log('📤 STDERR:', stderr);

            if (error) {
                console.error('❌ Execution error:', error.message);
                reject({
                    success: false,
                    error: error.message,
                    stdout: stdout,
                    stderr: stderr
                });
                return;
            }

            // Try multiple methods to get transaction hash
            let txHash = null;

            // Method 1: Try to extract from broadcast JSON file
            txHash = extractTxHashFromBroadcast(scriptName);

            // Method 2: Try regex patterns on stdout
            if (!txHash) {
                const patterns = [
                    /Transaction hash:\s*(0x[a-fA-F0-9]{64})/,
                    /transactionHash\s*[=:]\s*(0x[a-fA-F0-9]{64})/,
                    /hash\s*[=:]\s*(0x[a-fA-F0-9]{64})/i,
                    /"hash"\s*:\s*"(0x[a-fA-F0-9]{64})"/,
                ];

                for (const pattern of patterns) {
                    const match = stdout.match(pattern);
                    if (match) {
                        txHash = match[1];
                        console.log('✅ Extracted tx hash from stdout:', txHash);
                        break;
                    }
                }
            }

            console.log('✅ Execution completed');
            if (txHash) {
                console.log(`🔗 Transaction hash: ${txHash}`);
            } else {
                console.warn('⚠️ Could not extract transaction hash');
            }

            resolve({
                success: true,
                txHash: txHash,
                output: stdout,
                stderr: stderr
            });
        });
    });
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    // Check if required environment variables are set
    const requiredEnvVars = ['SEPOLIA_RPC_URL'];
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);

    // Check if Foundry is installed
    exec('forge --version', (error, stdout) => {
        const hasFoundry = !error;

        res.json({
            success: true,
            status: 'running',
            timestamp: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                hasFoundry: hasFoundry,
                foundryVersion: hasFoundry ? stdout.trim() : null,
                hasRpcUrl: !!process.env.SEPOLIA_RPC_URL,
                projectRoot: PROJECT_ROOT,
                missingEnvVars: missing
            }
        });
    });
});

/**
 * Add EIP-7702 delegation
 * POST /api/add-delegation
 */
app.post('/api/add-delegation', async (req, res) => {
    try {
        const { address, implementationAddress, privateKey } = req.body;

        console.log('\n🔵 Add Delegation Request');
        console.log('Address:', address);
        console.log('Implementation:', implementationAddress);

        // Validation
        if (!address || !implementationAddress || !privateKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: address, implementationAddress, privateKey'
            });
        }

        // Validate addresses
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid address format'
            });
        }

        if (!implementationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid implementation address format'
            });
        }

        // Validate private key
        const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        if (!cleanPrivateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid private key format (must be 64 hex characters)'
            });
        }

        // Execute Foundry script with implementation address
        console.log('🚀 Executing AddDelegationDynamic.s.sol...');
        console.log('📝 Using implementation address:', implementationAddress);
        
        const result = await executeFoundryScript(
            'AddDelegationDynamic.s.sol:AddDelegationDynamic',
            cleanPrivateKey,
            { IMPLEMENTATION_ADDRESS: implementationAddress }
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Delegation added successfully',
                txHash: result.txHash,
                explorerUrl: result.txHash 
                    ? `https://sepolia.etherscan.io/tx/${result.txHash}`
                    : null,
                type: 'Type 4 (EIP-7702)',
                address: address,
                implementationAddress: implementationAddress
            });
        } else {
            throw new Error(result.error || 'Script execution failed');
        }

    } catch (error) {
        console.error('❌ Add delegation error:', error);
        res.status(500).json({
            success: false,
            error: error.error || error.message || 'Failed to add delegation',
            details: error.stderr || error.stdout
        });
    }
});

/**
 * Remove EIP-7702 delegation
 * POST /api/remove-delegation
 */
app.post('/api/remove-delegation', async (req, res) => {
    try {
        const { address, privateKey } = req.body;

        console.log('\n🔴 Remove Delegation Request');
        console.log('Address:', address);

        // Validation
        if (!address || !privateKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: address, privateKey'
            });
        }

        // Validate address
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid address format'
            });
        }

        // Validate private key
        const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        if (!cleanPrivateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid private key format (must be 64 hex characters)'
            });
        }

        // Execute Foundry script
        console.log('🚀 Executing RemoveDelegation.s.sol...');
        const result = await executeFoundryScript(
            'RemoveDelegation.s.sol:RemoveDelegation',
            cleanPrivateKey
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Delegation removed successfully',
                txHash: result.txHash,
                explorerUrl: result.txHash 
                    ? `https://sepolia.etherscan.io/tx/${result.txHash}`
                    : null,
                type: 'Type 4 (EIP-7702)',
                address: address
            });
        } else {
            throw new Error(result.error || 'Script execution failed');
        }

    } catch (error) {
        console.error('❌ Remove delegation error:', error);
        res.status(500).json({
            success: false,
            error: error.error || error.message || 'Failed to remove delegation',
            details: error.stderr || error.stdout
        });
    }
});

/**
 * Send Native ETH via EIP-7702 (Type 4 Transaction)
 * POST /api/send-native
 */
app.post('/api/send-native', async (req, res) => {
    try {
        const { privateKey, implementationAddress, recipient, amount } = req.body;

        console.log('\n💸 Send Native ETH Request (Type 4)');
        console.log('Recipient:', recipient);
        console.log('Amount:', amount, 'ETH');
        console.log('Implementation:', implementationAddress);

        // Validation
        if (!privateKey || !implementationAddress || !recipient || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: privateKey, implementationAddress, recipient, amount'
            });
        }

        if (!recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid recipient address format'
            });
        }

        if (!implementationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid implementation address format'
            });
        }

        const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        if (!cleanPrivateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid private key format'
            });
        }

        // Convert amount to wei
        const amountInWei = ethers.parseEther(amount.toString()).toString();

        console.log('🚀 Executing SendEIP7702Transaction.s.sol...');
        console.log('Amount in Wei:', amountInWei);

        const result = await executeFoundryScript(
            'SendEIP7702Transaction.s.sol:SendEIP7702Transaction',
            cleanPrivateKey,
            {
                IMPLEMENTATION_ADDRESS: implementationAddress,
                RECIPIENT_ADDRESS: recipient,
                AMOUNT: amountInWei,
                // No TOKEN_ADDRESS means native transfer
            }
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Native ETH sent successfully via Type 4 transaction',
                txHash: result.txHash,
                explorerUrl: result.txHash 
                    ? `https://sepolia.etherscan.io/tx/${result.txHash}`
                    : null,
                type: 'Type 4 (EIP-7702)',
                recipient: recipient,
                amount: amount + ' ETH'
            });
        } else {
            throw new Error(result.error || 'Transaction failed');
        }

    } catch (error) {
        console.error('❌ Send native ETH error:', error);
        res.status(500).json({
            success: false,
            error: error.error || error.message || 'Failed to send native ETH',
            details: error.stderr || error.stdout
        });
    }
});

/**
 * Send ERC20 Token via EIP-7702 (Type 4 Transaction)
 * POST /api/send-token
 */
app.post('/api/send-token', async (req, res) => {
    try {
        const { privateKey, implementationAddress, tokenAddress, recipient, amount } = req.body;

        console.log('\n🪙 Send ERC20 Token Request (Type 4)');
        console.log('Token:', tokenAddress);
        console.log('Recipient:', recipient);
        console.log('Amount:', amount);
        console.log('Implementation:', implementationAddress);

        // Validation
        if (!privateKey || !implementationAddress || !tokenAddress || !recipient || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: privateKey, implementationAddress, tokenAddress, recipient, amount'
            });
        }

        if (!tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token address format'
            });
        }

        if (!recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid recipient address format'
            });
        }

        if (!implementationAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid implementation address format'
            });
        }

        const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        if (!cleanPrivateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid private key format'
            });
        }

        // Convert amount to smallest unit (assuming 18 decimals)
        const amountInWei = ethers.parseEther(amount.toString()).toString();

        console.log('🚀 Executing SendEIP7702Transaction.s.sol...');
        console.log('Amount in Wei:', amountInWei);

        const result = await executeFoundryScript(
            'SendEIP7702Transaction.s.sol:SendEIP7702Transaction',
            cleanPrivateKey,
            {
                IMPLEMENTATION_ADDRESS: implementationAddress,
                RECIPIENT_ADDRESS: recipient,
                TOKEN_ADDRESS: tokenAddress,
                AMOUNT: amountInWei
            }
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'ERC20 token sent successfully via Type 4 transaction',
                txHash: result.txHash,
                explorerUrl: result.txHash 
                    ? `https://sepolia.etherscan.io/tx/${result.txHash}`
                    : null,
                type: 'Type 4 (EIP-7702)',
                tokenAddress: tokenAddress,
                recipient: recipient,
                amount: amount
            });
        } else {
            throw new Error(result.error || 'Transaction failed');
        }

    } catch (error) {
        console.error('❌ Send token error:', error);
        res.status(500).json({
            success: false,
            error: error.error || error.message || 'Failed to send token',
            details: error.stderr || error.stdout
        });
    }
});

/**
 * Check delegation status
 * GET /api/check-delegation/:address
 */
app.get('/api/check-delegation/:address', async (req, res) => {
    try {
        const { address } = req.params;

        // Validation
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid address format'
            });
        }

        // This would require ethers.js or web3.js to check on-chain
        // For now, return a message that frontend should check via MetaMask
        res.json({
            success: true,
            message: 'Please check delegation status via frontend',
            address: address
        });

    } catch (error) {
        console.error('❌ Check delegation error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check delegation'
        });
    }
});

/**
 * Get Foundry version
 * GET /api/foundry-version
 */
app.get('/api/foundry-version', (req, res) => {
    exec('forge --version', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Foundry not installed or not in PATH',
                details: error.message
            });
        }

        res.json({
            success: true,
            version: stdout.trim()
        });
    });
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

/**
 * 404 handler
 */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Start server
app.listen(PORT, () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 EIP-7702 Backend API Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server running at: http://localhost:${PORT}`);
    console.log(`📂 Project root: ${PROJECT_ROOT}`);
    console.log(`\n🔗 Available Endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   POST /api/add-delegation`);
    console.log(`   POST /api/remove-delegation`);
    console.log(`   POST /api/send-native`);
    console.log(`   POST /api/send-token`);
    console.log(`   GET  /api/check-delegation/:address`);
    console.log(`   GET  /api/foundry-version`);
    console.log(`\n⚠️  SECURITY WARNING:`);
    console.log(`   This server handles private keys!`);
    console.log(`   Only use on localhost or secure network`);
    console.log(`   Never deploy to public internet without proper security`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check environment
    if (!process.env.SEPOLIA_RPC_URL) {
        console.log('⚠️  WARNING: SEPOLIA_RPC_URL not set in .env');
    }
    
    // Check Foundry installation
    exec('forge --version', (error, stdout) => {
        if (error) {
            console.log('⚠️  WARNING: Foundry not found. Please install Foundry.');
            console.log('   Install: curl -L https://foundry.paradigm.xyz | bash');
        } else {
            console.log(`✅ Foundry detected: ${stdout.trim()}`);
        }
    });
});