// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ICustomMetadataResolver} from "../Memberships.sol";

contract MockCustomMetadataResolver is ICustomMetadataResolver {
    function tokenURI(
        address, /* collection */
        uint256 /* tokenId */
    ) external pure returns (string memory) {
        return "tokenURI";
    }

    function contractURI(
        address /* collection */
    ) external pure returns (string memory) {
        return "contractURI";
    }
}
