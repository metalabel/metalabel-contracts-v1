// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DropEngineV2, ICollection} from "../engines/DropEngineV2.sol";

contract MockMinterV2 {
    function mint(
        DropEngineV2 engine,
        ICollection collection,
        uint16 sequenceId,
        uint8 count
    ) external {
        engine.mint(collection, sequenceId, count);
    }
}
