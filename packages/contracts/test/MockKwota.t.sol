// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockKwota} from "../src/MockKwota.sol";

contract Holder {
    function send(MockKwota t, address to, uint256 a) external {
        t.transfer(to, a);
    }
    function approve(MockKwota t, address s, uint256 a) external {
        t.approve(s, a);
    }
}

contract MockKwotaTest {
    MockKwota t;
    Holder h;

    function setUp() public {
        h = new Holder();
        t = new MockKwota(address(h), 1000 ether);
    }

    function testInitialSupply() public view {
        require(t.totalSupply() == 1000 ether, "supply");
        require(t.balanceOf(address(h)) == 1000 ether, "holder");
    }

    function testTransferAndAllowance() public {
        h.send(t, address(this), 10 ether);
        require(t.balanceOf(address(this)) == 10 ether, "recv");
        h.approve(t, address(this), 5 ether);
        t.transferFrom(address(h), address(1), 5 ether);
        require(t.balanceOf(address(1)) == 5 ether, "tf");
        require(t.allowance(address(h), address(this)) == 0, "allow");
    }

    function testOwnerMint() public {
        t.mint(address(2), 1 ether);
        require(t.totalSupply() == 1001 ether, "mint");
    }
}
