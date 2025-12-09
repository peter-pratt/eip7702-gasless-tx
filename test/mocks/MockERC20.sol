// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Minimal ERC20 token for testing BatchCallAndSponsor functionality
 */
contract MockERC20 is ERC20 {
    /**
     * @notice Constructor for MockERC20
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param initialSupply The initial supply to mint to the deployer
     */
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @notice Mint tokens to a specific account (for testing)
     * @param to The account to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Function that always reverts for testing call failures
     */
    function revertingFunction() external pure {
        revert("This function always reverts");
    }
}
