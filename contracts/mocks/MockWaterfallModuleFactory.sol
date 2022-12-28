// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IWaterfallModuleFactory} from "../WaterfallFactory.sol";

contract MockWaterfallModuleFactory is IWaterfallModuleFactory {
    /// @dev no-op for testing.
    function createWaterfallModule(
        address,
        address,
        address[] calldata,
        uint256[] calldata
    ) external pure returns (address wm) {
        wm = address(0);
    }
}
