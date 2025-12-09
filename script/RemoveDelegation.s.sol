// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";

/**
 * @title RemoveDelegation
 * @notice Removes EIP-7702 delegation from your EOA
 * 
 * This script removes the persistent delegation by setting it to address(0)
 * and then making a dummy transaction to commit the change on-chain.
 * 
 * FIXED: Works with backend by avoiding interactive prompts
 */
contract RemoveDelegation is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address payable senderAddress = payable(vm.addr(privateKey));
        
        console.log("=====================================");
        console.log("Removing EIP-7702 Delegation");
        console.log("=====================================");
        console.log("EOA Address:", senderAddress);

        // Check current state
        bytes memory codeBefore = senderAddress.code;
        console.log("\nCurrent delegation status:");
        
        if (codeBefore.length == 0) {
            console.log("No delegation currently active");
            console.log("EOA is already in normal state");
            return;
        } else if (codeBefore.length == 23) {
            console.log("Delegation IS active");
            console.log("Current code (23 bytes):");
            console.logBytes(codeBefore);

            // Parse the delegated address
            bytes memory addressBytes = new bytes(20);
            for(uint i = 0; i < 20; i++) {
                addressBytes[i] = codeBefore[i + 3];
            }
            address delegatedTo = address(uint160(bytes20(addressBytes)));
            console.log("Currently delegated to:", delegatedTo);
        } else {
            console.log("Unexpected code length:", codeBefore.length);
            console.logBytes(codeBefore);
        }

        console.log("\n[ACTION] Removing delegation...");
        
        vm.startBroadcast(privateKey);

        // Sign delegation to zero address to remove delegation
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(
            address(0),  // Zero address removes delegation
            privateKey
        );
        
        vm.attachDelegation(signedDelegation);
        console.log("Delegation signature attached");

        // FIXED: Use a different address to avoid the warning
        // Instead of sending to self (which has code), send to a known address
        address recipient = address(0x0000000000000000000000000000000000000001); // Burn address
        
        console.log("Broadcasting transaction to commit delegation removal...");
        
        // Send 0 ETH to burn address to commit the delegation change
        (bool success,) = recipient.call{value: 0}("");
        require(success, "Transaction failed");
        
        console.log("Transaction broadcast successfully!");
        
        vm.stopBroadcast();

        // Verify removal (this will still show old state in simulation)
        bytes memory codeAfter = senderAddress.code;
        console.log("\n[RESULT] Delegation removal transaction sent!");
        console.log("Expected new code length after mining: 0");
        console.log("Current code (in simulation):");
        console.logBytes(codeAfter);
        console.log("Transaction sent to remove delegation");
        console.log("Wait for transaction to be mined (~12 seconds)");
        console.log("\nThen verify with:");
        console.log("cast code", vm.toString(senderAddress), "--rpc-url $SEPOLIA_RPC_URL");
        console.log("\nView on Etherscan:");
        console.log(string.concat("https://sepolia.etherscan.io/address/", vm.toString(senderAddress)));
        console.log("=====================================");
    }
}