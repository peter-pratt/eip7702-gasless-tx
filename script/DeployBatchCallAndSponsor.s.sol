// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BatchCallAndSponsor} from "../src/BatchCallAndSponsor.sol";

contract DeployBatchCallAndSponsor is Script {
    function setUp() public {}

    function run() external returns (BatchCallAndSponsor) {
        /// Deploy the BatchCallAndSponsor contract:
        vm.startBroadcast();
        BatchCallAndSponsor batchCallAndSponsor = new BatchCallAndSponsor();
        console.log("BatchCallAndSponsor deployed to:", address(batchCallAndSponsor));
        vm.stopBroadcast();
        _updateAddressBook(address(batchCallAndSponsor));
        return batchCallAndSponsor;
    }

    function _updateAddressBook(address deployedAddress) internal {
        string memory network = vm.toString(block.chainid);
        string memory addressBookPath = string.concat("./script/addressBook/", network, ".json");
        string memory json = _buildJson(deployedAddress);

        console.log("new json to write::", json);
        vm.writeFile(addressBookPath, json);
        console.log("Updated addressBook.json:", network, "->", deployedAddress);
    }

    function _buildJson(address deployedAddress) internal returns (string memory) {
        string memory obj = "addrbook";
        string memory json = vm.serializeAddress(obj, "BatchCallAndSponsor", deployedAddress);
        return json;
    }
}
