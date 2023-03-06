# Metalabel Security Review V1_1

A security review of the [Metalabel](https://www.metalabel.xyz/) smart contract protocol was done by [Gogo](https://twitter.com/gogoauditor). \
This audit report includes all the vulnerabilities, issues and code improvements found during the security review.

## Disclaimer

"Audits are a time, resource and expertise bound effort where trained experts evaluate smart
contracts using a combination of automated and manual techniques to find as many vulnerabilities
as possible. Audits can show the presence of vulnerabilities **but not their absence**."

\- Secureum

## Risk classification

| Severity           | Impact: High | Impact: Medium | Impact: Low |
| :----------------- | :----------: | :------------: | :---------: |
| Likelihood: High   |   Critical   |      High      |   Medium    |
| Likelihood: Medium |     High     |     Medium     |      -      |
| Likelihood: Low    |    Medium    |       -        |      -      |

### Impact

- **High** - leads to a significant material loss of assets in the protocol or significantly harms a group of users.
- **Medium** - only a small amount of funds can be lost (such as leakage of value) or a core functionality of the protocol is affected.
- **Low** - can lead to any kind of unexpected behaviour with some of the protocol's functionalities that's not so critical.

### Likelihood

- **High** - attack path is possible with reasonable assumptions that mimic on-chain conditions and the cost of the attack is relatively low to the amount of funds that can be stolen or lost.
- **Medium** - only conditionally incentivized attack vector, but still relatively likely.
- **Low** - has too many or too unlikely assumptions or requires a huge stake by the attacker with little or no incentive.

### Actions required by severity level

- **Critical** - client **must** fix the issue.
- **High** - client **must** fix the issue.
- **Medium** - client **should** fix the issue.

## Executive summary

### Overview

|               |                                                                                                                                                   |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| Project Name  | Metalabel                                                                                                                                         |
| Repository    | https://github.com/metalabel/metalabel-contracts-v1_1                                                                                             |
| Commit hash   | [fb04291dfdf7114bbec12ef5ec30b4135eac4878](https://github.com/metalabel/metalabel-contracts-v1_1/commit/fb04291dfdf7114bbec12ef5ec30b4135eac4878) |
| Documentation | [link](https://metalabel.notion.site/Metalabel-Protocol-Walkthrough-V1-1-Addendum-3e18e13a1ccc48d68e777956a20279c6)                               |
| Methods       | Manual review                                                                                                                                     |
|               |

### Issues found

| Severity      | Count |
| :------------ | ----: |
| Critical risk |     0 |
| High risk     |     0 |
| Medium risk   |     6 |

### Scope

| File                                                                                                                                                                         | SLOC |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: |
| _Contracts (5)_                                                                                                                                                              |
| [contracts/Memberships.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/Memberships.sol)                   |  261 |
| [contracts/MembershipsFactory.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/MembershipsFactory.sol)     |   51 |
| [contracts/ControllerV1.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/ControllerV1.sol)                 |  172 |
| [contracts/engines/DropEngineV2.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol) |  299 |
| [contracts/RevenueModuleFactory.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/RevenueModuleFactory.sol) |   80 |
| _Abstracts (0)_                                                                                                                                                              |
| _Interfaces (0)_                                                                                                                                                             |
| _Total (5)_                                                                                                                                                                  |  863 |

# Findings

## Medium severity

### [M-1] Revenue can be forwarded to the null address when price = 0 and revenueRecipient == address(0), but priceDecayPerDay > 0

#### **Context**

- [contracts/engines/DropEngineV2.sol#L284-L290](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L284-L290)
- [contracts/engines/DropEngineV2.sol#L340-L345](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L340-L345)

#### **Description**

If a drop price is configured to decay to `0` and at the same time `decayStopTimestamp` is > `block.timestamp` (e.g. user want the initial price to be 5 ETH and after 5 days to go down to `0`), the `revenueRecipient` is restricted to be `address(0)`. This will lead to transferring all the revenue generated from a given drop to the [null address](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L284-L290).

#### **Recommended Mitigation Steps**

Modify the input validation in [DropEngineV2.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L340-L345) so users can configured sequences with price decaying to `0` and a `revenueRecipient != address(0)`. \
You can add the following check:

```diff
-       // Ensure that if a price is set, a recipient is set, and vice versa
-       if (
-           (dropData.price == 0) != (dropData.revenueRecipient == address(0))
-       ) {
-           revert InvalidPriceOrRecipient();
-       }

+       // Ensure that if a price or decaying price is set, a recipient is set, and vice versa
+       if (
+           (dropData.price == 0 && dropData.priceDecayPerDay == 0) !=
+           (dropData.revenueRecipient == address(0))
+       ) {
+           revert InvalidPriceOrRecipient();
+       }
```

### [M-2] Revenue recipient can cause DoS of the DropEngineV2.mint

#### **Context**

- [contracts/engines/DropEngineV2.sol#L284-L290](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L284-L290)

#### **Description**

If for some reason the `dropData.revenueRecipient` is set to an account that can not receive funds (e.g. a contract that doesn't have a payable `fallback` or `receive` function) nobody will be able to mint records from the given drop.

#### **Recommended Mitigation Steps**

Follow the [withdrawal pattern](https://docs.soliditylang.org/en/v0.8.18/common-patterns.html#withdrawal-from-contracts) for revenue collection. This is done for fee collection by the owner.

```diff
-       // Forward ETH to the revenue recipient
-       if (amountToForward > 0) {
-           (bool success, ) = drop.revenueRecipient.call{
-               value: amountToForward
-           }("");
-           if (!success) revert CouldNotTransferEth();
-       }

+       if (amountToForward > 0) {
+           revenueToReceive[drop.revenueRecipient] += amountToForward;
+       }
```

---

**NOTE**

The above will require changes to be made in the `DropEngineV2.transferFeesToOwner` function as well.

---

### [M-3] Owner should have some restrictions when setting the `primarySaleFeeBps`

#### **Context**

- [contracts/engines/DropEngineV2.sol#L186-L192](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L186-L192)

#### **Description**

Currently there's is a centralization issue with the privileged `owner` of `DropEngineV2`. As stated in a comment in `DropEngineV2.configureSequence`, you `don't allow the caller to control the primary sale fee`, instead it is only `set by the contract owner`. That means the `owner` decides how much to take from each mint order price. The owner can set the `primarySaleFeeBps` to 10000 (the max bps) and therefore take all of the revenue from each next drop leaving the `dropData.revenueRecipient` with nothing.

#### **Recommended Mitigation Steps**

Consider adding a constant (e.g. `MAX_PRIMARY_SALE_FEE_BPS`) that restricts the `owner` of the engine to set the primary sale fee to more than a given percent:

```diff
+   uint16 constant MAX_PRIMARY_SALE_FEE_BPS = 3000; // 30%

    /// @notice Set the primary sale fee for all drops configured on this
    /// engine. Only callable by owner
    function setPrimarySaleFeeBps(uint16 fee) external onlyOwner {
-       if (fee > 10000) revert InvalidPrimarySaleFee();
+       if (fee > MAX_PRIMARY_SALE_FEE_BPS) revert InvalidPrimarySaleFee();
        primarySaleFeeBps = fee;
        emit PrimarySaleFeeSet(fee);
    }
```

### [M-4] Insufficient input validation - `decayStopTimestamp` should be before `sealedAfterTimestamp`

- [contracts/engines/DropEngineV2.sol#L347-L353](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol#L347-L353)
- [contracts/Collection.sol#L212-L221](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/Collection.sol#L212-L221)

#### **Description**

The `_sequence.sealedAfterTimestamp` and `_sequence.sealedBeforeTimestamp` variables in `Collection.configureSequence` define a timebound sequence. When a drop has a decaying price the decay stop timestamp should logically be before the end of the records minting window. Otherwise the `dropData.price` will never be reached in the given window because of the checks in [`Collection._validateSequence`](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/Collection.sol#L290-L297).

#### **Recommended Mitigation Steps**

Verify that decayStopTimestamp is <= sealedAfterTimestamp in `Collection.configureSequence`.

### [M-5] Insufficient input validation - admin can transfer non-existent membership tokens from address(0) in `Memberships.sol`

- [contracts/Memberships.sol#L374-L381](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/Memberships.sol#L374-L381)

#### **Description**

Admin should not be able to transfer membership from the null address since it will result in DoS of the `mint`-ing functionality when an `id >= minted` is passed to `Memberships.adminTransferFrom`.

#### **Recommended Mitigation Steps**

Add the following check in `Memberships.adminTransferFrom`:

```diff

        if (to == address(0)) revert InvalidTransfer();
+       if (from == to) revert InvalidTransfer();
        if (balanceOf(to) != 0) revert InvalidTransfer();
        if (from != _tokenData[id].owner) revert InvalidTransfer();
```

### [M-6] Single-step ownership transfer can potentially lead to loosing all primary sales fees in DropEngineV2

- [contracts/engines/DropEngineV2.sol](https://github.com/metalabel/metalabel-contracts-v1_1/blob/fb04291dfdf7114bbec12ef5ec30b4135eac4878/contracts/engines/DropEngineV2.sol)

#### **Description**

Usually this would be considered a low severity issue, but in the case of the new `DropEngineV2` contract the owner is the only account that has access to the funds stored in the contract (the collected primary sales fees) so it is critical to ensure (on smart contracts level) it can't be mistakenly set to a non-existent ethereum account.

#### **Recommended Mitigation Steps**

Implement two-step ownership transfer for the `DropEngineV2` contract. Similar is done for the node ownership transfers in `NodeRegistry`.
