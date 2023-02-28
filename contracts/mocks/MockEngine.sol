// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ICollection} from "../interfaces/ICollection.sol";
import {IEngine, SequenceData} from "../interfaces/IEngine.sol";

contract MockEngine is IEngine {
    function getTokenURI(address, uint256)
        external
        pure
        override
        returns (string memory)
    {
        return "ipfs://QmURW9DGiSD8N2Dc85ToDypqhbTedzwgnjmCR732TzcSHF";
    }

    function getRoyaltyInfo(
        address,
        uint256,
        uint256
    ) external pure override returns (address, uint256) {
        return (address(0), 0);
    }

    function mint(ICollection collection, uint16 sequenceId)
        external
        returns (uint256 tokenId)
    {
        return
            collection.mintRecord(
                msg.sender,
                sequenceId,
                uint64(block.timestamp)
            );
    }

    function configureSequence(
        uint16, /* sequenceId */
        SequenceData calldata, /* sequenceData */
        bytes calldata /* engineData */
    ) external {
        // could revert to block
        // could store msg.sender -> engineData association
    }
}
