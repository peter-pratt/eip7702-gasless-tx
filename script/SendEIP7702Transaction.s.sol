// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {BatchCallAndSponsor} from "../src/BatchCallAndSponsor.sol";

/**
 * @title SendEIP7702Transaction
 * @notice Unified script for sending native ETH and ERC20 tokens via EIP-7702
 * @dev Supports both native and token transfers through BatchCallAndSponsor
 */
contract SendEIP7702Transaction is Script {
    
    // Read all parameters from environment variables
    function run() external {
        // 1. Get private key and derive sender address
        uint256 senderPrivateKey = vm.envUint("PRIVATE_KEY");
        address payable senderAddress = payable(vm.addr(senderPrivateKey));
        
        // 2. Get implementation address (BatchCallAndSponsor contract)
        address implementationAddress = vm.envAddress("IMPLEMENTATION_ADDRESS");
        
        // 3. Get transaction parameters
        address recipientAddress = vm.envAddress("RECIPIENT_ADDRESS");
        uint256 amount = vm.envUint("AMOUNT");
        
        // 4. Check if this is a token transfer (optional TOKEN_ADDRESS)
        address tokenAddress;
        bool isTokenTransfer = false;
        
        try vm.envAddress("TOKEN_ADDRESS") returns (address token) {
            if (token != address(0)) {
                tokenAddress = token;
                isTokenTransfer = true;
            }
        } catch {
            // Not a token transfer, just native ETH
        }
        
        console.log("=====================================");
        console.log("Sending EIP-7702 Transaction (Type 4)");
        console.log("=====================================");
        console.log("Sender:", senderAddress);
        console.log("Recipient:", recipientAddress);
        console.log("Implementation:", implementationAddress);
        console.log("Transfer Type:", isTokenTransfer ? "ERC20 Token" : "Native ETH");
        
        if (isTokenTransfer) {
            console.log("Token Address:", tokenAddress);
            console.log("Token Amount:", amount);
        } else {
            console.log("ETH Amount:", amount);
        }
        
        console.log("Sender Balance:", senderAddress.balance);
        console.log("=====================================");
        
        // 5. Prepare the batch call
        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](1);
        
        if (isTokenTransfer) {
            // ERC20 Token Transfer
            // Encode transfer(address to, uint256 amount)
            bytes memory transferData = abi.encodeWithSignature(
                "transfer(address,uint256)",
                recipientAddress,
                amount
            );
            
            calls[0] = BatchCallAndSponsor.Call({
                to: tokenAddress,
                value: 0,
                data: transferData
            });
            
            console.log("Prepared ERC20 transfer call");
        } else {
            // Native ETH Transfer
            require(senderAddress.balance >= amount, "Insufficient ETH balance");
            
            calls[0] = BatchCallAndSponsor.Call({
                to: recipientAddress,
                value: amount,
                data: ""
            });
            
            console.log("Prepared native ETH transfer call");
        }
        
        // 6. Start broadcasting with sender's private key
        vm.startBroadcast(senderPrivateKey);
        
        // 7. Sign and attach delegation
        console.log("Signing delegation...");
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(
            implementationAddress,
            senderPrivateKey
        );
        
        vm.attachDelegation(signedDelegation);
        console.log("Delegation attached!");
        
        // 8. Verify code is attached
        bytes memory code = senderAddress.code;
        console.log("Code length at sender address:", code.length);
        require(code.length > 0, "No code attached - delegation failed!");
        
        // 9. Execute the batch call
        console.log("Executing transaction...");
        BatchCallAndSponsor(senderAddress).execute(calls);
        
        console.log("=====================================");
        console.log("Transaction sent successfully!");
        console.log("Transaction Type: Type 4 (EIP-7702)");
        console.log("View on Etherscan:");
        console.log(string.concat("https://sepolia.etherscan.io/address/", vm.toString(senderAddress)));
        console.log("=====================================");
        
        vm.stopBroadcast();
    }
}