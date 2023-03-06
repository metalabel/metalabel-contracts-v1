# metalabel-contracts

Smart contracts for the Metalabel protocol.

## Links

* [Metalabel Protocol Walkthrough](https://metalabel.notion.site/Metalabel-Protocol-Walkthrough-2080c68cc6f242ebb7813b1a9236cab1) - Top-to-bottom conceptual and technical walkthrough of the protocol
* [Metalabel Protocol Walkthrough: V1.1 Addendum](https://metalabel.notion.site/Metalabel-Protocol-Walkthrough-V1-1-Addendum-3e18e13a1ccc48d68e777956a20279c6) - Covers the changes released as part of a V1.1 iteration

## Development

Install dependencies:

```
yarn
```

Compile all artifacts and generate typechain types:

```
yarn build
```

Run unit tests:

```
yarn test
```

Run unit tests showing gas usage by function and deploy costs:

```
REPORT_GAS=1 yarn test
```

Run unit tests and report coverage:

```
yarn test:coverage
```

## Deployment

Copy `.env.example` to `.env` and override the default values before deploying.

Deploy a contract:

```
yarn deploy --network goerli --contract MyContract
```

This will output the deployed contract address in the console and update the `./tasks/deployments.json` file.

> NOTE: The contract will automatically be verified on etherscan

### Verification

The `deploy` task will automatically verify contracts generally.

This can occasionally fail. If it does, verify manually:

```
yarn verify --network goerli $CONTRACT_ADDRESS
```

Verification may fail if run too quickly after contract deployment.
