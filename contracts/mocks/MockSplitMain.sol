// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ISplitMain} from "../SplitFactory.sol";

contract MockSplitMain is ISplitMain {
    /// @dev no-op for testing.
    function createSplit(
        address[] calldata,
        uint32[] calldata,
        uint32,
        address
    ) external pure override returns (address split) {
        split = address(0);
    }
}
