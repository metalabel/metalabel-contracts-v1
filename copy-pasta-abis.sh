#!/bin/bash

# script to copy ABIs from this repo to sibling repos (subgraph and frontend)

BASE=./artifacts/contracts
GRAPH=../metalabel-subgraph/abis
FRONTEND=../metalabel-app/sdk/abis

yarn build \
  && cp \
    $BASE/AccountRegistry.sol/AccountRegistry.json \
    $BASE/NodeRegistry.sol/NodeRegistry.json \
    $BASE/Collection.sol/Collection.json \
    $BASE/Memberships.sol/Memberships.json \
    $BASE/engines/DropEngineV2.sol/DropEngineV2.json \
    $BASE/CollectionFactory.sol/CollectionFactory.json \
    $BASE/MembershipsFactory.sol/MembershipsFactory.json \
    $BASE/RevenueModuleFactory.sol/RevenueModuleFactory.json \
    $BASE/ControllerV1.sol/ControllerV1.json \
      $GRAPH \
  && cp \
    $BASE/AccountRegistry.sol/AccountRegistry.json \
    $BASE/NodeRegistry.sol/NodeRegistry.json \
    $BASE/Collection.sol/Collection.json \
    $BASE/Memberships.sol/Memberships.json \
    $BASE/engines/DropEngineV2.sol/DropEngineV2.json \
    $BASE/CollectionFactory.sol/CollectionFactory.json \
    $BASE/MembershipsFactory.sol/MembershipsFactory.json \
    $BASE/RevenueModuleFactory.sol/RevenueModuleFactory.json \
    $BASE/ControllerV1.sol/ControllerV1.json \
      $FRONTEND \
  && cp \
    ./tasks/deployments.json $FRONTEND/../data \
  && \
    npx ts-node ./scripts/sync-deployments-to-subgraph.ts

