import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { NodeRegistry } from "../typechain-types";

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
