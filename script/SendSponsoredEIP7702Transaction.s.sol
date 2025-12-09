//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";
import {BatchCallAndSponsor} from "../src/BatchCallAndSponsor.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token","MOCK") {}

    function mint(address to, uint256 amount) external{
        _mint(to, amount);
    }
}

contract SendSponsoredEIP7702Transaction is Script {
    address payable constant IMPLEMENTATION_ADDRESS = payable(0x.........................);

    BatchCallAndSponsor public implementation;
    MockERC20 public token;

    address payable public aliceAddress;
    address payable public bobAddress;

    uint256 public alicePrivateKey;
    uint256 public bobPrivateKey;

    function run() external {
        alicePrivateKey = vm.envUint("PRIVATE_KEY");
        bobPrivateKey = vm.envUint("SPONSOR_PRIVATE_KEY");

        aliceAddress = payable(vm.addr(alicePrivateKey));
        bobAddress = payable(vm.addr(bobPrivateKey));
        
        console.log("=====================================");
        console.log("EIP-7702 Complete Demo");
        console.log("=====================================");
        console.log("Alice (Fund Owner):", aliceAddress);
        console.log("Bob (Sponsor):", bobAddress);
        console.log("Implementation:", IMPLEMENTATION_ADDRESS);
        console.log("=====================================\n");

        verifyImplementation();

        deployTokenAndSetup();

        performDirectExecution();

        performSponsoredExecution();

        printFinalSummary();
    }

    function verifyImplementation() internal {
        console.log("checking existing deployment");

        implementation = BatchCallAndSponsor(IMPLEMENTATION_ADDRESS);

        bytes memory code = IMPLEMENTATION_ADDRESS.code;
        require(code.length > 0, "Implementation contract not found!");

        console.log("Implementation contract found!");
        console.log("Implementation code length:", code.length, "bytes");
    }

    //deploy only once and comments this functionality.
    function deployTokenAndSetup() internal {
        console.log("deploying tokens and funding account");

        // Only deploy if broadcasting
        vm.startBroadcast(alicePrivateKey);
        
        // Check if token already exists (for re-runs)
        bool deployNew = true;
        
        if (deployNew) {
            token = new MockERC20();
            console.log("Token deployed to this address:", address(token));

            token.mint(aliceAddress, 1000e18);
            console.log("Minted 1000 Mock token to alice");
        }

        vm.stopBroadcast();

        console.log("current balance");
        console.log("Alice ETH:", aliceAddress.balance);
        console.log("Alice MOCK:", token.balanceOf(aliceAddress) / 1e18);
        console.log("Bob ETH:", bobAddress.balance);
        console.log("Bob MOCK:", token.balanceOf(bobAddress) / 1e18);
        console.log("=====================================\n");
    }

    function performDirectExecution() internal {
        console.log("[PART 1] DIRECT EXECUTION");
        console.log("alice execute transaction and pay own gas!");

        uint256 aliceEthBefore = aliceAddress.balance;

        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](2);

        calls[0] = BatchCallAndSponsor.Call({
            to: bobAddress,
            value: 0.001 ether,
            data: ""
        });

        calls[1] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(ERC20.transfer, (bobAddress, 100e18))
        });

        console.log("Batch created:");
        console.log("  [1] Send 0.001 ETH to Bob");
        console.log("  [2] Transfer 100 MOCK to Bob");

        // FIXED: Start broadcast BEFORE attaching delegation
        vm.startBroadcast(alicePrivateKey);
        
        // Attach delegation within the broadcast context
        vm.signAndAttachDelegation(IMPLEMENTATION_ADDRESS, alicePrivateKey);
        
        console.log("Alice Executing!");
        BatchCallAndSponsor(aliceAddress).execute(calls);
        
        vm.stopBroadcast();

        uint256 aliceETHAfter = aliceAddress.balance;

        uint256 aliceGasPaid = aliceEthBefore - aliceETHAfter - 0.001 ether;

        console.log("Direct execution successful!");
        console.log("Results:");
        console.log("  Bob received: 0.001 ETH");
        console.log("  Bob received: 100 MOCK tokens");
        console.log("  Alice paid gas:", aliceGasPaid);
        console.log("  Gas paid by: Alice");
        console.log("=====================================\n");
    }

    function performSponsoredExecution() internal {
        console.log("[PART 2] SPONSORED EXECUTION");
        console.log("Bob pays gas for Alice's transaction");

        address recipient = makeAddr("recipient");
        console.log("Recipient:", recipient);

        // Store balances before
        uint256[2] memory ethBefore = [aliceAddress.balance, bobAddress.balance];

        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](1);
        calls[0] = BatchCallAndSponsor.Call({
            to: recipient,
            value: 0.001 ether,
            data: ""
        });

        console.log("Batch created:");
        console.log("  [1] Send 0.001 ETH from Alice to recipient");
        
        console.log("Alice sign delegation...");
        vm.startBroadcast(bobPrivateKey);

        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(
            IMPLEMENTATION_ADDRESS,
            alicePrivateKey
        );
        console.log("delegation signed...");

        console.log("Bob attaching delegation");
        vm.attachDelegation(signedDelegation);

        bytes memory code = aliceAddress.code;
        require(code.length == 23, "Delegation not attached!");
        console.log("Delegation attached, code length:", code.length);

        console.log("Preparing Transaction data!");
        
        // Get the current nonce
        uint256 currentNonce = BatchCallAndSponsor(aliceAddress).nonce();
        console.log("Current Nonce:", currentNonce);
        
        // Encode each call individually and concatenate
        bytes memory encodedCalls = "";
        for(uint256 i = 0; i < calls.length; i++) {
            encodedCalls = abi.encodePacked(
                encodedCalls,
                calls[i].to,
                calls[i].value,
                calls[i].data
            );
        }
        
        // Create digest: hash(nonce, encodedCalls)
        bytes32 digest = keccak256(abi.encodePacked(currentNonce, encodedCalls));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(digest);

        console.log("Alice Signing Transactions!");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(alicePrivateKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        console.log("Transaction Signed!");

        console.log("Bob Executing Transactions!");
        console.log("Gas Payer: Bob");
        console.log("Fund Owner: Alice");

        BatchCallAndSponsor(aliceAddress).execute(calls, signature);
        vm.stopBroadcast();

        // Calculate changes
        uint256 aliceSpent = ethBefore[0] - aliceAddress.balance;
        uint256 bobGasPaid = ethBefore[1] - bobAddress.balance;

        console.log("Sponsored execution successful!");
        console.log("Results:");
        console.log("  Alice spent:", aliceSpent, "ETH (0.001 ETH sent + 0 gas)");
        console.log("  Bob spent:", bobGasPaid, "ETH (gas only)");
        console.log("  Recipient received:", recipient.balance, "ETH");
        console.log("  Gas paid by: Bob");
        console.log("  Funds from: Alice");
        console.log("=====================================\n");
    }

    function printFinalSummary() internal view {
        console.log("[SUMMARY] Final Balances");
        console.log("=====================================");
        console.log("Alice:");
        console.log("  ETH:", aliceAddress.balance);
        console.log("  MOCK:", token.balanceOf(aliceAddress) / 1e18, "tokens");
        console.log("");
        console.log("Bob:");
        console.log("  ETH:", bobAddress.balance);
        console.log("  MOCK:", token.balanceOf(bobAddress) / 1e18, "tokens");
        console.log("");
        console.log("Contracts:");
        console.log("  BatchCallAndSponsor:", IMPLEMENTATION_ADDRESS);
        console.log("  MockERC20:", address(token));
        console.log("");
        console.log("View on Etherscan:");
        console.log("  Alice:", string.concat("https://sepolia.etherscan.io/address/", vm.toString(aliceAddress)));
        console.log("  Bob:", string.concat("https://sepolia.etherscan.io/address/", vm.toString(bobAddress)));
        console.log("  Implementation:", string.concat("https://sepolia.etherscan.io/address/", vm.toString(IMPLEMENTATION_ADDRESS)));
        console.log("=====================================");
    }
}