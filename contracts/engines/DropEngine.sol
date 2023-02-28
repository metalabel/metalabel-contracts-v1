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

import {ICollection} from "../interfaces/ICollection.sol";
import {IEngine, SequenceData} from "../interfaces/IEngine.sol";
import {LibString} from "@metalabel/solmate/src/utils/LibString.sol";

/// @notice Data stored engine-side for each drop.
/// @dev Fits in a single storage slot. Price stored as uint80 means max price
/// per record is (2^80-1)/1e18 = 1,208,925 ETH. Royalty percentage is stored as
/// basis points, 5% = 500, max value of 100% = 10000 fits within 2byte int
struct DropData {
    uint80 price;
    uint16 royaltyBps;
    address revenueRecipient;
    // no bytes left
}

/// @notice Engine that implements a multi-NFT drop. In a given sequence:
/// - Token data stores edition number on mint (immutable)
/// - Token URIs are derived from as single base URI + edition number
/// - All tokens are the same price
/// - Primary sales and royalties go to the same revenue recipient
contract DropEngine is IEngine {
    // ---
    // Errors
    // ---

    /// @notice Invalid msg.value on purchase
    error IncorrectPaymentAmount();

    /// @notice If price or recipient is zero, they both have to be zero
    error InvalidPriceOrRecipient();

    /// @notice An invalid value was used for the royalty bps.
    error InvalidRoyaltyBps();

    /// @notice A permissioned mint or attempt to remove the mint authority was
    /// sent from an invalid msg.sender
    error NotMintAuthority();

    /// @notice A public mint was attempted for a sequence that currently has a
    /// mint authority set. Public mint opens after the mint authority is
    /// removed
    error PublicMintNotActive();

    /// @notice Public mints must come from an EOA and not a smart contract
    error MinterMustBeEOA();

    /// @notice Unable to forward ETH to the revenue recipient
    error CouldNotTransferEth();

    // ---
    // Events
    // ---

    /// @notice A new drop was created.
    /// @dev The collection already emits a SequenceCreated event, we're
    /// emitting the additional engine-specific data here.
    event DropCreated(
        address collection,
        uint16 sequenceId,
        uint80 price,
        uint16 royaltyBps,
        address recipient,
        string uriPrefix,
        address mintAuthority
    );

    /// @notice The permissioned mint authority for a sequence was removed.
    event PublicMintEnabled(address collection, uint16 sequenceId);

    // ---
    // Storage
    // ---

    /// @notice Drop data for a given collection + sequence ID.
    mapping(address => mapping(uint16 => DropData)) public drops;

    /// @notice Token URI prefix for a given collection + sequence ID
    /// @dev storing separately from DropData structure to save gas during
    /// storage reads on mint.
    mapping(address => mapping(uint16 => string)) public baseTokenURIs;

    /// @notice If set for a given collection / sequence, only this address can
    /// mint.
    mapping(address => mapping(uint16 => address)) public mintAuthorities;

    // ---
    // Mint functionality
    // ---

    /// @notice Mint a new record.
    function mint(ICollection collection, uint16 sequenceId)
        external
        payable
        returns (uint256 tokenId)
    {
        if (msg.sender != tx.origin) revert MinterMustBeEOA();

        DropData storage drop = drops[address(collection)][sequenceId];
        if (msg.value != drop.price) revert IncorrectPaymentAmount();

        // Check if this sequence is permissioned -- so long as there is a mint
        // authority, public mint is not active
        if (mintAuthorities[address(collection)][sequenceId] != address(0)) {
            revert PublicMintNotActive();
        }

        // Collection enforces max mint supply and mint window, so we're not
        // checking that here

        // If collection is a malicious contract, that does not impact any state
        // in the engine.  If it's a valid protocol-deployed collection, then it
        // will work as expected.
        tokenId = collection.mintRecord(msg.sender, sequenceId);

        // Forward ETH to the revenue recipient
        if (drop.price > 0) {
            (bool success, ) = drop.revenueRecipient.call{value: msg.value}("");
            if (!success) revert CouldNotTransferEth();
        }
    }

    // ---
    // Permissioned functionality
    // ---

    /// @notice Mint a new record to a specific address, only callable by the
    /// permissioned mint authority for the sequence.
    function permissionedMint(
        ICollection collection,
        uint16 sequenceId,
        address to
    ) external returns (uint256 tokenId) {
        // Ensure msg.sender is the permissioned mint authority
        if (mintAuthorities[address(collection)][sequenceId] != msg.sender) {
            revert NotMintAuthority();
        }

        // Not loading drop data here or sending ETH, permissioned mints are
        // free. Max supply and mint window are still enforced by the downstream
        // collection.

        tokenId = collection.mintRecord(to, sequenceId);
    }

    /// @notice Permanently remove the mint authority for a given sequence.
    function clearMintAuthority(ICollection collection, uint16 sequenceId)
        external
    {
        if (mintAuthorities[address(collection)][sequenceId] != msg.sender) {
            revert NotMintAuthority();
        }

        delete mintAuthorities[address(collection)][sequenceId];
        emit PublicMintEnabled(address(collection), sequenceId);
    }

    // ---
    // IEngine setup
    // ---

    /// @inheritdoc IEngine
    /// @dev There is no access control on this function, we infer the
    /// collection from msg.sender, and use that to key the stored data. If
    /// somebody calls this function with bogus info (instead of it getting
    /// called via the collection), it just wastes storage but does not impact
    /// contract functionality
    function configureSequence(
        uint16 sequenceId,
        SequenceData calldata, /* sequenceData */
        bytes calldata engineData
    ) external {
        (
            uint80 price,
            uint16 royaltyBps,
            address recipient,
            string memory uriPrefix,
            address mintAuthority
        ) = abi.decode(engineData, (uint80, uint16, address, string, address));

        // Ensure that if a price is set, a recipient is set, and vice versa
        if ((price == 0) != (recipient == address(0))) {
            revert InvalidPriceOrRecipient();
        }

        // Ensure royaltyBps is in range
        if (royaltyBps > 10000) revert InvalidRoyaltyBps();

        // Set the permissioned mint authority if provided
        if (mintAuthority != address(0)) {
            mintAuthorities[msg.sender][sequenceId] = mintAuthority;
        }

        // Write engine data (passed through from the collection when the
        // collection admin calls `configureSequence`) to a struct in the engine
        // with all the needed info.
        drops[msg.sender][sequenceId] = DropData({
            price: price,
            royaltyBps: royaltyBps,
            revenueRecipient: recipient
        });
        baseTokenURIs[msg.sender][sequenceId] = uriPrefix;
        emit DropCreated(
            msg.sender,
            sequenceId,
            price,
            royaltyBps,
            recipient,
            uriPrefix,
            mintAuthority
        );
    }

    // ---
    // IEngine views
    // ---

    /// @inheritdoc IEngine
    /// @dev Token URI is derived from the base URI + edition number. Edition
    /// number is written to immutable token data on mint.
    function getTokenURI(address collection, uint256 tokenId)
        external
        view
        override
        returns (string memory)
    {
        uint16 sequenceId = ICollection(collection).tokenSequenceId(tokenId);
        uint80 editionNumber = ICollection(collection).tokenMintData(tokenId);

        return
            string(
                abi.encodePacked(
                    baseTokenURIs[collection][sequenceId],
                    LibString.toString(editionNumber),
                    ".json"
                )
            );
    }

    /// @inheritdoc IEngine
    /// @dev Royalty bps and recipient is per-sequence.
    function getRoyaltyInfo(
        address collection,
        uint256 tokenId,
        uint256 salePrice
    ) external view override returns (address, uint256) {
        uint16 sequenceId = ICollection(collection).tokenSequenceId(tokenId);
        DropData storage drop = drops[collection][sequenceId];
        return (drop.revenueRecipient, (salePrice * drop.royaltyBps) / 10000);
    }
}
