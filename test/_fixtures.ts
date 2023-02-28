import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { NodeRegistry } from "../typechain-types";
import { MerkleTree } from "merkletreejs";
import { BigNumber, BigNumberish, constants } from "ethers";
import { defaultAbiCoder, parseUnits } from "ethers/lib/utils";

interface CreateNode {
  nodeType: number;
  owner: number;
  parent: number;
  groupNode: number;
  metadata: string;
  intialControllers: string[];
}

export const createCreateNode =
  (accounts: SignerWithAddress[], nodeRegistry: NodeRegistry) =>
  async (data: Partial<CreateNode> = {}, account = accounts[0]) => {
    const args: CreateNode = {
      nodeType: 1,
      owner: 0,
      parent: 0,
      groupNode: 0,
      metadata: "",
      intialControllers: [],
      ...data,
    };
    return nodeRegistry
      .connect(account)
      .createNode(
        args.nodeType,
        args.owner,
        args.parent,
        args.groupNode,
        args.intialControllers,
        args.metadata
      );
  };

export const currentTimestamp = async () => {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  const timestamp = block.timestamp;
  return timestamp;
};

export const parseBase64 = (base64: string) => {
  const [prefix, encoded] = base64.split(",");
  if (prefix !== "data:application/json;base64") {
    throw new Error("invalid base64 token");
  }
  const json = Buffer.from(encoded, "base64").toString();
  const parsed = JSON.parse(json);
  return parsed;
};

export const createMerkleTree = (types: string[], data: unknown[][]) => {
  const leaves = data.map((d) => ethers.utils.solidityKeccak256(types, d));
  const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true });

  const createProof = (data: unknown[]) => {
    const leaf = ethers.utils.solidityKeccak256(types, data);
    const proof = tree.getHexProof(leaf);
    return proof;
  };

  const createProofForIndex = (index: number) => createProof(data[index]);

  return { tree, createProof, createProofForIndex };
};

export const createCreateCollectionConfig = (
  data: Partial<{
    name: string;
    symbol: string;
    contractURI: string;
    owner: string;
    controlNodeId: BigNumberish;
    metadata: string;
  }> = {}
) => {
  return {
    name: "name",
    symbol: "symbol",
    contractURI: "ipfs://contractURI",
    owner: constants.AddressZero,
    controlNodeId: "0",
    metadata: "metadata",
    ...data,
  };
};

export const createCreateMembershipsConfig = (
  data: Partial<{
    name: string;
    symbol: string;
    baseURI: string;
    owner: string;
    controlNodeId: BigNumberish;
    metadata: string;
  }> = {}
) => {
  return {
    name: "name",
    symbol: "symbol",
    baseURI: "https://metalabel.cloud/api/memberships/",
    owner: constants.AddressZero,
    controlNodeId: "0",
    metadata: "metadata",
    ...data,
  };
};

export const encodeDropEngineV2Data = (
  price: BigNumber,
  royaltyBps: number,
  recipient: string,
  configs: Partial<{
    allowContractMints: boolean;
    randomizeMetadataVariants: boolean;
    maxRecordsPerTransaction: number;
    decayStopTimestamp: BigNumberish;
    priceDecayPerDay: BigNumberish;
    primarySaleFeeBps: number;
  }> = {}
) => {
  return defaultAbiCoder.encode(
    [
      "tuple(uint96 price, uint16 royaltyBps, bool allowContractMints, bool randomizeMetadataVariants, uint8 maxRecordsPerTransaction, address revenueRecipient, uint16 primarySaleFeeBps, uint96 priceDecayPerDay, uint64 decayStopTimestamp)",
      "tuple(string name, string description, string image, string external_url, string metalabel_record_variant_name, string metalabel_release_metadata_uri, uint16[] metalabel_record_contents, tuple(string trait_type, string value)[] attributes)[]",
    ],
    [
      {
        price: price,
        priceDecayPerDay: "0",
        decayStopTimestamp: "0",
        royaltyBps,
        allowContractMints: false,
        randomizeMetadataVariants: false,
        maxRecordsPerTransaction: 1,
        revenueRecipient: recipient,
        primarySaleFeeBps: 0,
        ...configs,
      },
      [
        {
          name: "name1",
          description: "description",
          image: "image",
          external_url: "https://metalabel.xyz",
          metalabel_release_metadata_uri: "ipfs://hash",
          metalabel_record_variant_name: "Variant 1",
          metalabel_record_contents: [1, 2, 3],
          attributes: [
            { trait_type: "foo", value: "bar1" },
            { trait_type: "bar", value: "baz1" },
          ],
        },
        {
          name: "name2",
          description: "description",
          image: "image",
          external_url: "https://metalabel.xyz",
          metalabel_release_metadata_uri: "ipfs://hash",
          metalabel_record_variant_name: "Variant 2",
          metalabel_record_contents: [1, 2, 4, 5],
          attributes: [
            { trait_type: "foo", value: "bar2" },
            { trait_type: "bar", value: "baz2" },
          ],
        },
      ],
    ]
  );
};

export const generateSequenceConfig = (engineAddress: string) => {
  return {
    dropNodeId: 1,
    engine: engineAddress,
    sealedAfterTimestamp: 0,
    sealedBeforeTimestamp: 0,
    maxSupply: 10000,
    minted: 0,
  };
};
