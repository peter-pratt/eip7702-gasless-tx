// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";

/**
 * @title AddDelegationDynamic
 * @notice Add EIP-7702 delegation with dynamic implementation address
 * 
 * This script reads IMPLEMENTATION_ADDRESS from environment variable
 * making it perfect for backend API usage where address comes from user input
 */
contract AddDelegationDynamic is Script {
    
    function run() external {
        // Read from environment variables
        uint256 senderPrivateKey = vm.envUint("PRIVATE_KEY");
        address implementationAddress = vm.envAddress("IMPLEMENTATION_ADDRESS");
        
        address payable senderAddress = payable(vm.addr(senderPrivateKey));
        
        console.log("=====================================");
        console.log("Adding EIP-7702 Delegation (Dynamic)");
        console.log("=====================================");
        console.log("Sender Address:", senderAddress);
        console.log("Implementation:", implementationAddress);
        console.log("Sender Balance:", senderAddress.balance);
        console.log("=====================================");

        // Validate implementation address
        require(implementationAddress != address(0), "Invalid implementation address");
        require(implementationAddress.code.length > 0, "Implementation has no code");

        vm.startBroadcast(senderPrivateKey);
        
        // Sign and attach delegation
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(
            implementationAddress,
            senderPrivateKey
        );
        
        vm.attachDelegation(signedDelegation);
        
        console.log("Delegation signature created and attached");

        // Verify code was attached
        bytes memory code = senderAddress.code;
        console.log("Code length at sender address:", code.length);
        require(code.length > 0, "Delegation failed - no code attached");

        // Make a transaction to commit the delegation
        // Send 0 ETH to a safe address (burn address)
        address recipient = address(0x0000000000000000000000000000000000000001);
        (bool success,) = recipient.call{value: 0}("");
        require(success, "Transaction failed");
        
        console.log("Delegation committed on-chain");
        console.log("=====================================");
        console.log("Transaction sent successfully!");
        console.log("View on Etherscan:");
        console.log(string.concat("https://sepolia.etherscan.io/address/", vm.toString(senderAddress)));
        console.log("=====================================");
        
        vm.stopBroadcast();
    }
}