// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

/*

███╗   ███╗███████╗████████╗ █████╗ ██╗      █████╗ ██████╗ ███████╗██╗
████╗ ████║██╔════╝╚══██╔══╝██╔══██╗██║     ██╔══██╗██╔══██╗██╔════╝██║
██╔████╔██║█████╗     ██║   ███████║██║     ███████║██████╔╝█████╗  ██║
██║╚██╔╝██║██╔══╝     ██║   ██╔══██║██║     ██╔══██║██╔══██╗██╔══╝  ██║
██║ ╚═╝ ██║███████╗   ██║   ██║  ██║███████╗██║  ██║██████╔╝███████╗███████╗
╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝


Deployed by Metalabel with 💖 as a permanent application on the Ethereum blockchain.

Metalabel is a growing universe of tools, knowledge, and resources for
metalabels and cultural collectives.

Our purpose is to establish the metalabel as key infrastructure for creative
collectives and to inspire a new culture of creative collaboration and mutual
support.

OUR SQUAD

Anna Bulbrook (Curator)
Austin Robey (Community)
Brandon Valosek (Engineer)
Ilya Yudanov (Designer)
Lauren Dorman (Engineer)
Rob Kalin (Board)
Yancey Strickler (Director)

https://metalabel.xyz

*/

import {AccountRegistry} from "./AccountRegistry.sol";
import {INodeRegistry, NodeType, NodeData} from "./interfaces/INodeRegistry.sol";

/// @notice The node registry maintains a tree of ownable nodes that are used to
/// catalog logical entities and manage access control in the Metalabel
/// universe.
/// - Nodes anchor metadata for logical entities
/// - Nodes express a logical hierarchy between entities
/// - Nodes have access control semantics that can be used to determine
///     authorization around various actions
contract NodeRegistry is INodeRegistry {
    // ---
    // Events
    // ---

    /// @notice A new node was created.
    event NodeCreated(
        uint64 indexed id,
        NodeType indexed nodeType,
        uint64 indexed owner,
        uint64 parent,
        uint64 groupNode,
        string metadata
    );

    /// @notice A node ownership transfer was initiated.
    event NodeOwnerTransferPending(
        uint64 indexed id,
        uint64 indexed pendingOwner
    );

    /// @notice A node's owner was updated.
    event NodeOwnerSet(uint64 indexed id, uint64 indexed owner);

    /// @notice A node's parent was updated.
    event NodeParentSet(uint64 indexed id, uint64 indexed parent);

    /// @notice A node's group node was updated.
    event NodeGroupNodeSet(uint64 indexed id, uint64 indexed groupNode);

    /// @notice An arbitrary event was been emitted from a node.
    event NodeBroadcast(uint64 indexed id, string topic, string message);

    /// @notice A node controller was authorized or unauthorized.
    event NodeControllerSet(
        uint64 indexed id,
        address indexed controller,
        bool isAuthorized
    );

    // ---
    // Errors
    // ---

    /// @notice An unauthorized agent attempted to modify or create a child
    /// node.
    error NotAuthorizedForNode();

    /// @notice An invalid config was provided during node creation.
    error InvalidNodeCreate();

    // ---
    // Storage
    // ---

    /// @notice Total number of registered nodes.
    uint64 public totalNodeCount;

    /// @notice Mapping from node IDs to node data.
    mapping(uint64 => NodeData) public nodes;

    /// @notice The account registry.
    AccountRegistry public immutable accounts;

    /// @notice Flags for allowed external addresses that can create new child
    /// nodes or manage existing nodes.
    /// @dev nodeId => address => isAuthorized
    mapping(uint64 => mapping(address => bool)) public controllers;

    /// @notice Mapping from a node ID to its pending transfer owner
    mapping(uint64 => uint64) public pendingNodeOwnerTransfers;

    // ---
    // Constructor
    // ---

    constructor(AccountRegistry _accounts) {
        accounts = _accounts;
    }

    // ---
    // Access control modifiers
    // ---

    /// @dev Checks that msg.sender can manage the given node.
    modifier onlyAuthorized(uint64 nodeId) {
        if (!isAuthorizedAddressForNode(nodeId, msg.sender)) {
            revert NotAuthorizedForNode();
        }
        _;
    }

    // ---
    // Node creation
    // ---

    /// @inheritdoc INodeRegistry
    function createNode(
        NodeType nodeType,
        uint64 owner,
        uint64 parent,
        uint64 groupNode,
        address[] memory initialControllers,
        string memory metadata
    ) external returns (uint64 id) {
        // nodeType > 0 is used to check if a node exists
        if (nodeType == NodeType.INVALID_NODE_TYPE) revert InvalidNodeCreate();

        // If owner is set, it must be msg.sender. If msg.sender does not have
        // an account, resolveId will revert
        if (owner != 0 && owner != accounts.resolveId(msg.sender)) {
            revert NotAuthorizedForNode();
        }

        if (parent != 0) {
            // Ensure parent node exists
            if (nodes[parent].nodeType == NodeType.INVALID_NODE_TYPE) {
                revert InvalidNodeCreate();
            }
            // Ensure msg.sender is authorized to manage the parent node.
            if (!isAuthorizedAddressForNode(parent, msg.sender)) {
                revert NotAuthorizedForNode();
            }
        }

        if (groupNode != 0) {
            // Ensure group node exists
            if (nodes[groupNode].nodeType == NodeType.INVALID_NODE_TYPE) {
                revert InvalidNodeCreate();
            }
            // Ensure msg.sender is authorized to manage the group node.
            if (!isAuthorizedAddressForNode(groupNode, msg.sender)) {
                revert NotAuthorizedForNode();
            }
        }

        // Create the node.
        id = ++totalNodeCount;
        nodes[id] = NodeData({
            nodeType: nodeType,
            owner: owner,
            parent: parent,
            groupNode: groupNode
        });
        emit NodeCreated(id, nodeType, owner, parent, groupNode, metadata);

        // Add any initial controllers provided.
        for (uint256 i = 0; i < initialControllers.length; i++) {
            address controller = initialControllers[i];
            controllers[id][controller] = true;
            emit NodeControllerSet(id, controller, true);
        }
    }

    // ---
    // Node management
    // ---

    /// @notice Allow the owner of a node to relinquish ownership.
    function removeNodeOwner(uint64 id) external {
        NodeData memory node = nodes[id];
        uint64 accountId = accounts.resolveId(msg.sender);

        // If this node has an owner, it must be msg.sender. If msg.sender does
        // not have an account, resolveId will revert above
        if (node.owner != accountId) {
            revert NotAuthorizedForNode();
        }

        nodes[id].owner = 0;
        delete pendingNodeOwnerTransfers[id];
        emit NodeOwnerSet(id, 0);
    }

    /// @notice Start the 2-step node transfer process. Can only be called by
    /// the existing node owner if there is one, or by the group owner if not.
    /// if newOwner = 0, the node owner transfer will be canceled effectively
    function startNodeOwnerTransfer(uint64 id, uint64 newOwner) external {
        NodeData memory node = nodes[id];
        uint64 accountId = accounts.resolveId(msg.sender);

        // If this node has an owner, it must be msg.sender. If msg.sender does
        // not have an account, resolveId will revert above
        if (node.owner != 0 && node.owner != accountId) {
            revert NotAuthorizedForNode();
        }
        // Else if this node has no owner, node must have a group node and
        // msg.sender must be group node owner. We are only checking the owner
        // here because we do not want to allow controllers to set the owner.
        else if (
            node.owner == 0 &&
            (node.groupNode == 0 || nodes[node.groupNode].owner != accountId)
        ) {
            revert NotAuthorizedForNode();
        }

        // start transfer process
        emit NodeOwnerTransferPending(id, newOwner);
        pendingNodeOwnerTransfers[id] = newOwner;
    }

    /// @notice Complete the 2-step node transfer process. Can only be called by
    /// by the new owner
    function completeNodeOwnerTransfer(uint64 id) external {
        uint64 newOwner = pendingNodeOwnerTransfers[id];
        uint64 accountId = accounts.resolveId(msg.sender);

        // Ensure msg.sender is the new account owner. If msg.sender does not
        // have an account, resolveId will revert
        if (newOwner != accountId) {
            revert NotAuthorizedForNode();
        }

        nodes[id].owner = newOwner;
        delete pendingNodeOwnerTransfers[id];
        emit NodeOwnerSet(id, newOwner);
    }

    /// @notice Modify a node's parent. Msg.sender must be authorized to manage
    /// the node, AND authorized to manage the new parent node. This is a
    /// restrictive check, but creative use of future controllers can make it
    /// easier to re-parent a node
    function setParentNode(uint64 id, uint64 parent)
        external
        onlyAuthorized(id)
        onlyAuthorized(parent)
    {
        nodes[id].parent = parent;
        emit NodeParentSet(id, parent);
    }

    /// @notice Modify a node's group node. Msg.sender must be authorized to
    /// manage the node AND authorized to manage the new group node.  group
    /// node.  This is a restrictive check, but creative use of future
    /// controllers can make it easier to re-parent a node
    function setNodeGroupNode(uint64 id, uint64 groupNode)
        external
        onlyAuthorized(id)
        onlyAuthorized(groupNode)
    {
        nodes[id].groupNode = groupNode;
        emit NodeGroupNodeSet(id, groupNode);
    }

    /// @notice Broadcast an arbitrary event from a node. Msg.sender must be
    /// authorized to manage the node
    function broadcast(
        uint64 id,
        string calldata topic,
        string calldata message
    ) external onlyAuthorized(id) {
        emit NodeBroadcast(id, topic, message);
    }

    /// @notice Set or remove an address as a node controller. Msg.sender must
    /// be the node owner or group node owner, controllers cannot add additional
    /// controllers
    function setController(
        uint64 node,
        address controller,
        bool isAuthorized
    ) external {
        // using isAuthorizedAccountForNode here instead of
        // isAuthorizedAddressForNode, we dont want controllers to be able to
        // add additional controllers
        if (!isAuthorizedAccountForNode(node, accounts.resolveId(msg.sender))) {
            revert NotAuthorizedForNode();
        }

        controllers[node][controller] = isAuthorized;
        emit NodeControllerSet(node, controller, isAuthorized);
    }

    // ---
    // Node views
    // ---

    /// @notice Resolve node owner account.
    function ownerOf(uint64 id) external view returns (uint64) {
        return nodes[id].owner;
    }

    /// @notice Resolve node group node.
    function groupNodeOf(uint64 id) external view returns (uint64) {
        return nodes[id].groupNode;
    }

    /// @notice Resolve a node's parent.
    function parentOf(uint64 id) external view returns (uint64) {
        return nodes[id].parent;
    }

    /// @notice Determine if an account is authorized to manage a node. Account
    /// must own the node, or own the group node of this node
    function isAuthorizedAccountForNode(uint64 node, uint64 account)
        public
        view
        returns (bool isAuthorized)
    {
        NodeData memory mnode = nodes[node];

        // Ensure invalid account or invalid node is always NOT authorized.
        if (account == 0 || mnode.nodeType == NodeType.INVALID_NODE_TYPE) {
            isAuthorized = false;
        }
        // If this node is directly owned by the account, then it's authorized.
        else if (mnode.owner == account) {
            isAuthorized = true;
        }
        // If this node's group node is owned by the account, then its
        // authorized. Not checking if groupNode or groupNode owner is zero,
        // since we know account is non-zero
        else if (nodes[mnode.groupNode].owner == account) {
            isAuthorized = true;
        }

        // Otherwise, not authorized.
    }

    /// @inheritdoc INodeRegistry
    function isAuthorizedAddressForNode(uint64 node, address subject)
        public
        view
        returns (bool isAuthorized)
    {
        NodeData memory mnode = nodes[node];
        uint64 account = accounts.unsafeResolveId(subject);

        // invalid or root node has no authorized addresses
        if (node == 0) {
            isAuthorized = false;
        }
        // If this node is directly owned by the resolved account, then it's
        // authorized.
        else if (mnode.owner == account && account != 0) {
            isAuthorized = true;
        }
        // Else, if this node's group node is owned by the resolved
        // account, then it's authorized.
        else if (nodes[mnode.groupNode].owner == account && account != 0) {
            isAuthorized = true;
        }
        // Else, if the address is authorized to manage the node, then it's
        // authorized
        else if (controllers[node][subject]) {
            isAuthorized = true;
        }
        // Else, if the address is authorized to manage the group node,
        // then it's authorized
        else if (controllers[mnode.groupNode][subject]) {
            isAuthorized = true;
        }

        // Otherwise, not authorized.
    }
}
