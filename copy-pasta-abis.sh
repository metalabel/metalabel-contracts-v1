#!/bin/bash

# script to copy ABIs from this repo to sibling repos (subgraph and frontend)

BASE=./artifacts/contracts
GRAPH=../metalabel-subgraph/abis
FRONTEND=../metalabel-hub/sdk/abis

yarn build \
  && cp \
    $BASE/AccountRegistry.sol/AccountRegistry.json \
    $BASE/NodeRegistry.sol/NodeRegistry.json \
    $BASE/Collection.sol/Collection.json \
    $BASE/CollectionFactory.sol/CollectionFactory.json \
    $BASE/SplitFactory.sol/SplitFactory.json \
    $BASE/WaterfallFactory.sol/WaterfallFactory.json \
    $BASE/engines/DropEngine.sol/DropEngine.json \
      $GRAPH \
  && cp \
    $BASE/AccountRegistry.sol/AccountRegistry.json \
    $BASE/NodeRegistry.sol/NodeRegistry.json \
    $BASE/Collection.sol/Collection.json \
    $BASE/CollectionFactory.sol/CollectionFactory.json \
    $BASE/SplitFactory.sol/SplitFactory.json \
    $BASE/WaterfallFactory.sol/WaterfallFactory.json \
    $BASE/engines/DropEngine.sol/DropEngine.json \
    $BASE/engines/TestEngine.sol/TestEngine.json \
      $FRONTEND

