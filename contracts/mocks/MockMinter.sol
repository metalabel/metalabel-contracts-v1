// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {DropEngine, ICollection} from "../engines/DropEngine.sol";

contract MockMinter {
    function mint(
        DropEngine engine,
        ICollection collection,
        uint16 sequenceId
    ) external {
        engine.mint(collection, sequenceId);
    }
}
