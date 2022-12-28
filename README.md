# metalabel-contracts

Smart contracts for the Metalabel protocol.

## Links

* [Metalabel Protocol Walkthrough](https://metalabel.notion.site/040-Metalabel-Protocol-Walkthrough-64e892c31f6a4090a2c92088300b62c4) - Top-to-bottom conceptual and technical walkthrough of the protocol

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
