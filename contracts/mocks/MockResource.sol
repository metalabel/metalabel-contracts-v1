// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Resource} from "../Resource.sol";
import {INodeRegistry} from "../interfaces/INodeRegistry.sol";

contract MockResource is Resource {
    /// @notice The node registry contract.
    INodeRegistry private _nodeRegistry;

    /// @notice The control node ID for this resource.
    uint64 private _controlNode;

    function setup(INodeRegistry _registry, uint64 nodeId) external {
        _nodeRegistry = _registry;
        _controlNode = nodeId;
    }

    function nodeRegistry() public view override returns (INodeRegistry) {
        return _nodeRegistry;
    }

    function controlNode() public view override returns (uint64) {
        return _controlNode;
    }
}
