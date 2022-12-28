// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @notice Collections are ERC721 contracts that contain records.
interface ICollection {
    /// @notice Mint a new record with custom immutable token data. Only
    /// callable by the sequence-specific engine.
    function mintRecord(
        address to,
        uint16 sequenceId,
        uint80 tokenData
    ) external returns (uint256 tokenId);

    /// @notice Mint a new record with the edition number of the seqeuence
    /// written to the immutable token data. Only callable by the
    /// sequence-specific engine.
    function mintRecord(address to, uint16 sequenceId)
        external
        returns (uint256 tokenId);

    /// @notice Get the sequence ID for a given token.
    function tokenSequenceId(uint256 tokenId)
        external
        view
        returns (uint16 sequenceId);

    /// @notice Get the immutable mint data for a given token.
    function tokenMintData(uint256 tokenId) external view returns (uint80 data);
}
