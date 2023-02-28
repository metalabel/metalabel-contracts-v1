// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DropEngineV2, ICollection} from "../engines/DropEngineV2.sol";

contract MockBrokenRecipient {
    receive() external payable {
        revert();
    }

    function mintOnDropEngineV2(
        DropEngineV2 dropEngine,
        ICollection collection,
        uint16 sequenceId,
        uint8 count
    ) external payable returns (uint256) {
        return dropEngine.mint{value: msg.value}(collection, sequenceId, count);
    }
}
