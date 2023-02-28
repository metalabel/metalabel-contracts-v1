// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Resource, AccessControlData} from "../Resource.sol";
import {INodeRegistry} from "../interfaces/INodeRegistry.sol";

contract MockResource is Resource {
    /// @notice The node registry contract.
    INodeRegistry private _nodeRegistry;

    /// @notice The control node ID for this resource.
    uint64 private _controlNode;

    function setup(INodeRegistry _registry, uint64 nodeId) external {
        accessControl = AccessControlData({
            nodeRegistry: _registry,
            controlNodeId: nodeId
        });
    }
}
