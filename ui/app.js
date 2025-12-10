/**
 * EIP-7702 Delegation Manager - Network Validation Fixed
 */

// Configuration
const BACKEND_API_URL = 'http://localhost:3001/api';
const SEPOLIA_CHAIN_ID = '0xaa36a7';
const SEPOLIA_CHAIN_ID_DECIMAL = 11155111;

// State
let account = null;
let backendAvailable = false;
let provider = null;
let implementation_Address = null;
let userPrivateKey = null;
let delegationActive = false;
let currentNetwork = null;
let isSepoliaNetwork = false;

let nativeTransactionController = null;
let tokenTransactionController = null;

// Transaction state (ADD THESE)
let isNativeTransactionInProgress = false;
let isTokenTransactionInProgress = false;

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('load', async () => {
    console.log('🔵 EIP-7702 UI Initialized');
    
    // Check if ethers is loaded
    if (typeof ethers === 'undefined') {
        console.error('❌ ethers.js not loaded!');
        showError('ethers.js library failed to load. Please refresh the page.');
        return;
    }
    
    console.log('✅ ethers.js loaded:', ethers.version);
    
    // Check backend status
    await checkBackendStatus();
    
    // Check if wallet already connected
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            account = accounts[0];
            provider = new ethers.BrowserProvider(window.ethereum);
            showMainContent();
            await checkNetwork();
            await refreshAll();
        }

        // Listen for account/chain changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', async () => {
            console.log('🔄 Network changed, reloading...');
            window.location.reload();
        });
    } else {
        console.warn('⚠️ MetaMask not detected');
    }
});

async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        showError('Please connect to MetaMask');
        location.reload();
    } else if (accounts[0] !== account) {
        account = accounts[0];
        location.reload();
    }
}

// ============================================
// BACKEND STATUS
// ============================================

async function checkBackendStatus() {
    const statusEl = document.getElementById('backendStatus');
    
    try {
        const response = await fetch(`${BACKEND_API_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            backendAvailable = true;
            statusEl.textContent = 'Connected ✓';
            statusEl.className = 'status-badge status-connected';
            console.log('✅ Backend API connected');
            console.log('Foundry:', data.environment.foundryVersion || 'Not found');
        } else {
            throw new Error('Backend unhealthy');
        }
    } catch (error) {
        backendAvailable = false;
        statusEl.textContent = 'Disconnected ✗';
        statusEl.className = 'status-badge status-disconnected';
        console.warn('⚠️ Backend API not available');
        console.warn('Start backend: cd backend && npm start');
    }
}

// ============================================
// WALLET CONNECTION
// ============================================

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showError('Please install MetaMask!');
        return;
    }

    try {
        console.log('🔗 Requesting wallet connection...');
        
        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        account = accounts[0];
        provider = new ethers.BrowserProvider(window.ethereum);
        
        console.log('✅ Wallet connected:', account);

        showMainContent();
        
        // Check network AFTER showing main content
        await checkNetwork();
        await getBalance();
        await checkDelegation();
        
        if (isSepoliaNetwork) {
            showSuccess('Wallet connected successfully to Sepolia Testnet!');
        } else {
            showError('Connected to wrong network! Please switch to Sepolia Testnet for EIP-7702 support.');
        }

    } catch (error) {
        console.error('❌ Failed to connect wallet:', error);
        showError('Failed to connect wallet: ' + error.message);
    }
}

function showMainContent() {
    document.getElementById('walletConnectSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('accountAddress').textContent = account;
}

async function refreshAll() {
    console.log('🔄 Refreshing all data...');
    await checkNetwork();
    await getBalance();
    await checkDelegation();
}

async function checkNetwork() {
    if (!provider) {
        console.warn('⚠️ Cannot check network: provider not set');
        document.getElementById('networkName').textContent = 'Not connected';
        return;
    }

    try {
        console.log('🔍 Checking network...');
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        currentNetwork = chainId;
        
        console.log('📡 Network Chain ID:', chainId);
        
        // Map chain IDs to network names
        const networkNames = {
            1: 'Ethereum Mainnet',
            5: 'Goerli Testnet',
            11155111: 'Sepolia Testnet',
            137: 'Polygon Mainnet',
            80001: 'Mumbai Testnet',
            56: 'BSC Mainnet',
            97: 'BSC Testnet',
            42161: 'Arbitrum One',
            421613: 'Arbitrum Goerli',
            10: 'Optimism',
            420: 'Optimism Goerli',
            43114: 'Avalanche C-Chain',
            43113: 'Avalanche Fuji'
        };
        
        const networkName = networkNames[chainId] || `Unknown Network (Chain ID: ${chainId})`;
        isSepoliaNetwork = (chainId === SEPOLIA_CHAIN_ID_DECIMAL);
        
        const networkElement = document.getElementById('networkName');
        networkElement.textContent = networkName;
        
        console.log('📍 Network:', networkName);
        console.log('📍 Is Sepolia?', isSepoliaNetwork);
        
        // Show/hide network warning banner
        const warningBanner = document.getElementById('networkWarning');
        if (!isSepoliaNetwork) {
            warningBanner.classList.remove('hidden');
            warningBanner.classList.add('show');
        } else {
            warningBanner.classList.add('hidden');
            warningBanner.classList.remove('show');
        }
        
        // Color code the network name
        if (isSepoliaNetwork) {
            networkElement.style.color = '#22543d';
            networkElement.style.fontWeight = '600';
            console.log('✅ Connected to Sepolia Testnet');
        } else {
            networkElement.style.color = '#e53e3e';
            networkElement.style.fontWeight = '600';
            console.warn('⚠️ Not on Sepolia Testnet!');
        }
        
    } catch (error) {
        console.error('❌ Error checking network:', error);
        document.getElementById('networkName').textContent = 'Error checking network';
        isSepoliaNetwork = false;
    }
}

async function getBalance() {
    if (!account || !provider) {
        console.warn('⚠️ Cannot get balance: account or provider not set');
        return;
    }

    try {
        console.log('💰 Fetching balance for:', account);
        const balance = await provider.getBalance(account);
        const ethBalance = ethers.formatEther(balance);
        
        console.log('✅ Balance:', ethBalance, 'ETH');
        document.getElementById('accountBalance').textContent = 
            parseFloat(ethBalance).toFixed(4) + ' ETH';
    } catch (error) {
        console.error('❌ Error fetching balance:', error);
        showError('Failed to fetch balance: ' + error.message);
    }
}

// ============================================
// NETWORK VALIDATION
// ============================================

function validateSepoliaNetwork() {
    console.log('🔍 Validating network... isSepoliaNetwork =', isSepoliaNetwork);
    
    if (!isSepoliaNetwork) {
        showError('⚠️ Wrong Network!\n\nPlease switch to Sepolia Testnet.\n\nEIP-7702 is only supported on Sepolia Testnet.');
        return false;
    }
    return true;
}

async function switchToSepolia() {
    try {
        console.log('🔄 Attempting to switch to Sepolia...');
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
        
        showSuccess('Switching to Sepolia Testnet...');
        
        // Wait for switch to complete
        setTimeout(async () => {
            await checkNetwork();
            await getBalance();
        }, 1500);
    } catch (error) {
        console.error('❌ Failed to switch network:', error);
        
        // Error code 4902 means the chain hasn't been added to MetaMask
        if (error.code === 4902) {
            showError('Sepolia Testnet not found in MetaMask. Please add it manually.');
        } else {
            showError('Failed to switch to Sepolia. Please switch manually in MetaMask.');
        }
    }
}

// ============================================
// DELEGATION MANAGEMENT
// ============================================

async function checkDelegation() {
    if (!account) {
        console.warn('⚠️ Cannot check delegation: account not set');
        return;
    }

    // Validate network first
    if (!validateSepoliaNetwork()) {
        console.log('❌ Network validation failed for checkDelegation');
        return;
    }

    const btn = document.getElementById('checkDelegationBtn');
    btn.innerHTML = '<span class="loading"></span> Checking...';

    try {
        console.log('🔍 Checking delegation for:', account);
        
        const code = await window.ethereum.request({
            method: 'eth_getCode',
            params: [account, 'latest']
        });

        console.log('📝 Code:', code);
        const codeLength = (code.length - 2) / 2;
        document.getElementById('codeLength').textContent = codeLength + ' bytes';

        if (code === '0x' || code.length <= 2) {
            // Normal EOA
            delegationActive = false;
            document.getElementById('delegationStatus').textContent = 'Normal EOA';
            document.getElementById('delegationStatus').className = 'status-badge status-normal';
            document.getElementById('accountType').textContent = 'Externally Owned Account';
            document.getElementById('delegationDetails').classList.add('hidden');
            console.log('✅ Account is normal EOA');
        } else if (code.length === 48) {
            // EIP-7702 delegated (0x + 46 hex = 23 bytes)
            const magic = code.slice(2, 8);
            const delegatedTo = "0x" + code.slice(8, 48);
            delegationActive = true;

            console.log('✅ EIP-7702 delegation detected!');
            console.log('Magic:', magic);
            console.log('Delegated to:', delegatedTo);

            document.getElementById('delegationStatus').textContent = 'Delegated ✓';
            document.getElementById('delegationStatus').className = 'status-badge status-delegated';
            document.getElementById('accountType').textContent = 'Smart Account (EIP-7702)';
            document.getElementById('magicNumber').textContent = '0x' + magic + (magic === 'ef0100' ? ' ✓ Valid' : ' ✗ Invalid');
            document.getElementById('delegatedTo').innerHTML = `<a href="https://sepolia.etherscan.io/address/${delegatedTo}" target="_blank">${delegatedTo}</a>`;
            document.getElementById('delegationDetails').classList.remove('hidden');

            showSuccess('Active EIP-7702 delegation detected!');
        } else {
            // Unexpected
            console.warn('⚠️ Unexpected code length:', codeLength);
            document.getElementById('delegationStatus').textContent = 'Unexpected';
            document.getElementById('delegationStatus').className = 'status-badge status-normal';
            document.getElementById('accountType').textContent = 'Unknown (' + codeLength + ' bytes)';
            document.getElementById('delegationDetails').classList.add('hidden');
        }
    } catch (error) {
        console.error('❌ Failed to check delegation:', error);
        showError('Failed to check delegation: ' + error.message);
    } finally {
        btn.textContent = 'Check Delegation';
    }
}

async function addDelegationViaBackend() {
    console.log('🟢 addDelegationViaBackend called');
    console.log('🔍 Current network state: isSepoliaNetwork =', isSepoliaNetwork);
    
    // Validate network first
    if (!validateSepoliaNetwork()) {
        console.log('❌ Network validation failed for addDelegation');
        return;
    }

    if (!backendAvailable) {
        showError('Backend API not available. Please start the backend server:\n\ncd backend && npm start');
        return;
    }

    // Check if delegation is already active AND private key is stored
    if (delegationActive && userPrivateKey && implementation_Address) {
        showError('Delegation is already active for this session!\n\nImplementation: ' + implementation_Address + '\n\nYou can now send transactions. To change delegation, please remove it first.');
        return;
    }

    const implementationAddress = document.getElementById('implementationAddress').value;
    const privateKey = document.getElementById('privateKeyInput').value;

    // Validation
    if (!implementationAddress || !implementationAddress.startsWith('0x') || implementationAddress.length !== 42) {
        showError('Please enter a valid implementation address (0x + 40 hex characters)');
        return;
    }
    implementation_Address = implementationAddress;

    if (!privateKey || privateKey.trim() === '') {
        showError('Please enter your private key');
        return;
    }
    
    // Validate private key format
    const cleanKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
    if (!cleanKey.match(/^0x[a-fA-F0-9]{64}$/)) {
        showError('Invalid private key format');
        return;
    }

    // Verify the private key matches the connected account
    try {
        const wallet = new ethers.Wallet(cleanKey);
        if (wallet.address.toLowerCase() !== account.toLowerCase()) {
            showError('Private key does not match connected wallet!');
            return;
        }
    } catch (error) {
        showError('Invalid private key');
        return;
    }

    userPrivateKey = cleanKey;

    const btn = document.getElementById('addDelegationBtnMain');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Processing Type 4 Transaction...';
    btn.disabled = true;

    try {
        console.log('🚀 Sending add delegation request to backend...');
        
        const response = await fetch(`${BACKEND_API_URL}/add-delegation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: account,
                implementationAddress: implementationAddress,
                privateKey: cleanKey
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`✅ Delegation added via Type 4 transaction!\n\nTx Hash: ${data.txHash || 'Processing...'}`);
            
            if (data.txHash) {
                showTransactionHash(data.txHash, 'Type 4 (EIP-7702)');
            }

            // Clear private key
            document.getElementById('privateKeyInput').value = '';

            // Refresh delegation status after delay
            setTimeout(() => {
                checkDelegation();
            }, 5000);
        } else {
            showError(`Failed to add delegation: ${data.error}`);
        }
    } catch (error) {
        showError(`Backend API error: ${error.message}\n\nMake sure backend is running on http://localhost:3001`);
        console.error('Add delegation error:', error);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

async function removeDelegationViaBackend() {
    console.log('🔴 removeDelegationViaBackend called');
    console.log('🔍 Current network state: isSepoliaNetwork =', isSepoliaNetwork);
    
    // Validate network first
    if (!validateSepoliaNetwork()) {
        console.log('❌ Network validation failed for removeDelegation');
        return;
    }

    if (!backendAvailable) {
        showError('Backend API not available. Please start the backend server:\n\ncd backend && npm start');
        return;
    }

    // Check if delegation is active
    if (!delegationActive) {
        showError('No active delegation found! Please add delegation first.');
        return;
    }

    const implementationAddress = document.getElementById('implementationAddress').value;
    const privateKey = document.getElementById('privateKeyInput').value;

    // Validation
    if (!implementationAddress || !implementationAddress.startsWith('0x') || implementationAddress.length !== 42) {
        showError('Please enter a valid implementation address (0x + 40 hex characters)');
        return;
    } 

    // Validation
    if (!privateKey || privateKey.trim() === '') {
        showError('Please enter your private key');
        return;
    }

    // Validate private key format
    const cleanKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
    if (!cleanKey.match(/^0x[a-fA-F0-9]{64}$/)) {
        showError('Invalid private key format');
        return;
    }

    // Verify the private key matches the connected account
    try {
        const wallet = new ethers.Wallet(cleanKey);
        if (wallet.address.toLowerCase() !== account.toLowerCase()) {
            showError('Private key does not match connected wallet!');
            return;
        }
    } catch (error) {
        showError('Invalid private key');
        return;
    }

    const confirmed = confirm('Are you sure you want to remove delegation?\n\nThis will return your account to a normal EOA.');
    if (!confirmed) return;

    const btn = document.getElementById('removeDelegationBtnMain');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Processing Type 4 Transaction...';
    btn.disabled = true;

    try {
        console.log('🚀 Sending remove delegation request to backend...');
        
        const response = await fetch(`${BACKEND_API_URL}/remove-delegation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: account,
                privateKey: privateKey
            })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`✅ Delegation removed via Type 4 transaction!\n\nTx Hash: ${data.txHash || 'Processing...'}`);
            
            if (data.txHash) {
                showTransactionHash(data.txHash, 'Type 4 (EIP-7702)');
            }

            // Clear private key
            document.getElementById('privateKeyInput').value = '';

            // Refresh delegation status after delay
            setTimeout(() => {
                checkDelegation();
            }, 5000);
        } else {
            showError(`Failed to remove delegation: ${data.error}`);
        }
    } catch (error) {
        showError(`Backend API error: ${error.message}\n\nMake sure backend is running on http://localhost:3001`);
        console.error('Remove delegation error:', error);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// ============================================
// TRANSACTION MANAGEMENT
// ============================================

function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'native') {
        tabs[0].classList.add('active');
        document.getElementById('nativeForm').classList.remove('hidden');
        document.getElementById('tokenForm').classList.add('hidden');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('nativeForm').classList.add('hidden');
        document.getElementById('tokenForm').classList.remove('hidden');
    }
}

async function sendNativeTransaction() {
    console.log('💸 sendNativeTransaction called');
    console.log('🔍 Current network state: isSepoliaNetwork =', isSepoliaNetwork);

    // Check if transaction already in progress
    if (isNativeTransactionInProgress) {
        console.log('⚠️ Transaction already in progress, ignoring click');
        return;
    }
    
    // Validate network first
    if (!validateSepoliaNetwork()) {
        console.log('❌ Network validation failed for sendNative');
        return;
    }

    const recipient = document.getElementById('nativeRecipient').value;
    const amount = document.getElementById('nativeAmount').value;

    // Validation
    if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
        showError('Please enter a valid recipient address');
        return;
    }

    if (!amount || parseFloat(amount) <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    if (!delegationActive) {
        showError('Please add delegation first before sending transactions');
        return;
    }

    if (!userPrivateKey) {
        showError('Private key not available. Please add delegation again.');
        return;
    }

    if (!implementation_Address) {
        showError('Implementation address not available. Please add delegation again.');
        return;
    }

    if (!backendAvailable) {
        showError('Backend API not available. Please start the backend server.');
        return;
    }

    // const btn = document.getElementById('sendNativeBtn');
    // btn.innerHTML = '<span class="loading"></span> Sending...';
    // btn.disabled = true;

    // Set transaction in progress flag
    isNativeTransactionInProgress = true;

    const btnSpan = document.getElementById('sendNativeBtn');
    const btn = btnSpan.parentElement;
    const cancelBtn = document.querySelector('#nativeForm .btn-secondary');
    btnSpan.innerHTML = '<span class="loading"></span> Sending...';
    btn.disabled = true;
    cancelBtn.disabled = false;
    cancelBtn.style.opacity = '1';

    try {
        console.log('🚀 Sending Type 4 native transaction via backend...');
        
        // Create AbortController for this transaction
        nativeTransactionController = new AbortController();

        const response = await fetch(`${BACKEND_API_URL}/send-native`, {
            signal: nativeTransactionController.signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                privateKey: userPrivateKey,
                implementationAddress: implementation_Address,
                recipient: recipient,
                amount: amount
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showTransactionHash(data.txHash, 'Type 4 (EIP-7702)');
            showSuccess('Native ETH sent successfully via Type 4 transaction!');
            
            // Clear form
            document.getElementById('nativeRecipient').value = '';
            document.getElementById('nativeAmount').value = '';
            
            // Refresh balance after delay
            setTimeout(getBalance, 3000);
        } else {
            throw new Error(data.error || 'Transaction failed');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('❌ Transaction cancelled by user');
        } else {
            showError('Transaction failed: ');
            console.error('Send native error:');
        }
    } finally {
        btnSpan.innerHTML = 'Send ETH';
        btn.disabled = false;
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.5';
        nativeTransactionController = null;
        isNativeTransactionInProgress = false; // Reset flag
    }
}

async function sendTokenTransaction() {
    console.log('🪙 sendTokenTransaction called');
    console.log('🔍 Current network state: isSepoliaNetwork =', isSepoliaNetwork);

    // Check if transaction already in progress
    if (isTokenTransactionInProgress) {
        console.log('⚠️ Transaction already in progress, ignoring click');
        return;
    }
    
    // Validate network first
    if (!validateSepoliaNetwork()) {
        console.log('❌ Network validation failed for sendToken');
        return;
    }
    
    const tokenAddress = document.getElementById('tokenAddress').value;
    const recipient = document.getElementById('tokenRecipient').value;
    const amount = document.getElementById('tokenAmount').value;

    // Validation
    if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
        showError('Please enter a valid token address');
        return;
    }

    if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
        showError('Please enter a valid recipient address');
        return;
    }

    if (!amount || parseFloat(amount) <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    if (!delegationActive) {
        showError('Please add delegation first before sending transactions');
        return;
    }

    if (!userPrivateKey) {
        showError('Private key not available. Please add delegation again.');
        return;
    }

    if (!implementation_Address) {
        showError('Implementation address not available. Please add delegation again.');
        return;
    }

    if (!backendAvailable) {
        showError('Backend API not available. Please start the backend server.');
        return;
    }

    // const btn = document.getElementById('sendTokenBtn');
    // btn.innerHTML = '<span class="loading"></span> Sending...';
    // btn.disabled = true;

     // Set transaction in progress flag
    isTokenTransactionInProgress = true;

    const btnSpan = document.getElementById('sendTokenBtn');
    const btn = btnSpan.parentElement;
    const cancelBtn = document.querySelector('#tokenForm .btn-secondary');
    btnSpan.innerHTML = '<span class="loading"></span> Sending...';
    btn.disabled = true;
    cancelBtn.disabled = false;
    cancelBtn.style.opacity = '1';

    try {
        console.log('🚀 Sending Type 4 token transaction via backend...');

        // Create AbortController for this transaction
        tokenTransactionController = new AbortController();

        const response = await fetch(`${BACKEND_API_URL}/send-token`, {
            signal: tokenTransactionController.signal,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                privateKey: userPrivateKey,
                implementationAddress: implementation_Address,
                tokenAddress: tokenAddress,
                recipient: recipient,
                amount: amount
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showTransactionHash(data.txHash, 'Type 4 (EIP-7702)');
            showSuccess('Token transaction sent successfully via Type 4!');
            
            // Clear form
            document.getElementById('tokenAddress').value = '';
            document.getElementById('tokenRecipient').value = '';
            document.getElementById('tokenAmount').value = '';
        } else {
            throw new Error(data.error || 'Transaction failed');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('❌ Transaction cancelled by user');
        } else {
            showError('Transaction failed: ');
            console.error('Send token error:');
        }
    } finally {
        btnSpan.innerHTML = 'Send Tokens';
        btn.disabled = false;
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.5';
        tokenTransactionController = null;
        isTokenTransactionInProgress = false; // Reset flag
    }
}

function cancelNativeTransaction() {
    if (nativeTransactionController) {
        nativeTransactionController.abort();
        nativeTransactionController = null;
        
        // Reset buttons
        const btnSpan = document.getElementById('sendNativeBtn');
        const btn = btnSpan.parentElement;
        const cancelBtn = document.querySelector('#nativeForm .btn-secondary');
        
        btnSpan.innerHTML = 'Send ETH';
        btn.disabled = false;
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.5';
        
        showSuccess('Native transaction cancelled');
    }
}

function cancelTokenTransaction() {
    if (tokenTransactionController) {
        tokenTransactionController.abort();
        tokenTransactionController = null;
        
        // Reset buttons
        const btnSpan = document.getElementById('sendTokenBtn');
        const btn = btnSpan.parentElement;
        const cancelBtn = document.querySelector('#tokenForm .btn-secondary');
        
        btnSpan.innerHTML = 'Send Tokens';
        btn.disabled = false;
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.5';
        
        showSuccess('Token transaction cancelled');
    }
}

function showTransactionHash(hash, type) {
    document.getElementById('transactionCard').classList.remove('hidden');
    const link = document.getElementById('txHashLink');
    link.href = `https://sepolia.etherscan.io/tx/${hash}`;
    link.textContent = hash;
    document.getElementById('txType').textContent = type || 'Type 4 (EIP-7702)';
}

// ============================================
// UI HELPERS
// ============================================

function showError(message) {
    console.error('❌', message);
    const alert = document.getElementById('errorAlert');
    document.getElementById('errorMessage').textContent = message;
    alert.classList.add('show');
    alert.classList.remove('hidden');
    setTimeout(() => {
        alert.classList.remove('show');
        alert.classList.add('hidden');
    }, 5000);
}

function showSuccess(message) {
    console.log('✅', message);
    const alert = document.getElementById('successAlert');
    document.getElementById('successMessage').textContent = message;
    alert.classList.add('show');
    alert.classList.remove('hidden');
    setTimeout(() => {
        alert.classList.remove('show');
        alert.classList.add('hidden');
    }, 5000);
}