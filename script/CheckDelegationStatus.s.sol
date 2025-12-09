// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

/**
 * @title CheckDelegationStatus
 * @notice Check if your EOA currently has an active EIP-7702 delegation
 * 
 * This is a read-only script that doesn't broadcast any transactions.
 * It simply checks the current state of your EOA.
 */
contract CheckDelegationStatus is Script {
    function run() external view {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address senderAddress = vm.addr(privateKey);

        console.log("=====================================");
        console.log("EIP-7702 Delegation Status Check");
        console.log("=====================================");
        console.log("EOA Address:", senderAddress);
        console.log("Balance:", senderAddress.balance);

        // Get the code at the address
        bytes memory code = senderAddress.code;
        
        console.log("\n--- Delegation Status ---");
        console.log("Code length:", code.length);
        
        if (code.length == 0) {
            console.log("Status: NORMAL EOA");
            console.log("No delegation active");
            console.log("Your account is a standard externally owned account");
        } else if (code.length == 23) {
            console.log("Status: DELEGATED");
            console.log("Active EIP-7702 delegation detected");
            
            // Parse the delegation designator
            console.log("\nFull delegation designator:");
            console.logBytes(code);
            
            // Extract magic prefix (first 3 bytes)
            bytes3 magic = bytes3(abi.encodePacked(code[0], code[1], code[2]));
            console.log("\nMagic prefix:", vm.toString(magic));
            
            if (magic == 0xef0100) {
                console.log("Valid EIP-7702 magic number");
            } else {
                console.log("Invalid magic number");
            }
            
            // Extract delegated address (bytes 3-22, which is 20 bytes)
            // Correct method: Skip first 3 bytes (0xef0100), take next 20 bytes
            bytes memory addressBytes = new bytes(20);
            for(uint i = 0; i < 20; i++) {
                addressBytes[i] = code[i + 3];  // Skip magic prefix
            }
            address delegatedTo = address(uint160(bytes20(addressBytes)));
            console.log("\nDelegated to:", delegatedTo);
            
            // Check if the implementation exists
            bytes memory implCode = delegatedTo.code;
            console.log("Implementation code length:", implCode.length);
            
            if (implCode.length > 0) {
                console.log("Implementation contract exists");
            } else {
                console.log("Implementation contract not found");
            }
        } else {
            console.log("Status: UNEXPECTED");
            console.log("Code length is neither 0 nor 23 bytes");
            console.log("Full code:");
            console.logBytes(code);
        }

        console.log("\n--- Account Type ---");
        if (code.length == 0) {
            console.log("Type: Externally Owned Account (EOA)");
        } else {
            console.log("Type: Smart Account (EIP-7702)");
        }

        console.log("\nView on Etherscan:");
        console.log("https://sepolia.etherscan.io/address/", senderAddress);
        console.log("=====================================");
    }
}