// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockKwota} from "../src/MockKwota.sol";

interface Vm {
    function envAddress(string calldata) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// forge script script/DeployMock.s.sol --rpc-url robinhood_testnet --broadcast --interactives 1
/// (key entered interactively / via hardware wallet — never stored in the repo)
contract DeployMock {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (MockKwota token) {
        address holder = vm.envAddress("MOCK_INITIAL_HOLDER");
        vm.startBroadcast();
        token = new MockKwota(holder, 1_000_000_000 ether);
        vm.stopBroadcast();
    }
}
