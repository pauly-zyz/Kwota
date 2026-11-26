// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockKwota — TESTNET ONLY stand-in for $KWOTA.
/// @notice The real $KWOTA is launched manually on Pons. This minimal ERC-20 lets
///         the indexer and kwota engine be tested end-to-end on Robinhood Chain
///         testnet (46630). Do not deploy to mainnet.
contract MockKwota {
    string public constant name = "Mock KWOTA (testnet)";
    string public constant symbol = "mKWOTA";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    address public immutable owner;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address initialHolder, uint256 initialSupply) {
        require(block.chainid != 4663, "testnet only");
        owner = msg.sender;
        _mint(initialHolder, initialSupply);
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "allowance");
            allowance[from][msg.sender] = a - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero to");
        uint256 b = balanceOf[from];
        require(b >= amount, "balance");
        unchecked {
            balanceOf[from] = b - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
