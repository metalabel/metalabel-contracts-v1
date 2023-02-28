import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  AccountRegistry,
  NodeRegistry,
  MockSplitMain__factory,
  SplitFactory,
} from "../typechain-types";
import { expect } from "chai";
import { constants } from "ethers";
import { createCreateNode } from "./_fixtures";

const { loadFixture } = waffle;

describe("SplitFactory.sol", () => {
  // ---
  // fixtures
  // ---

  let MockSplitMain: MockSplitMain__factory;
  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let factory: SplitFactory;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;
  let createNode: ReturnType<typeof createCreateNode>;

  async function fixture() {
    MockSplitMain = (await ethers.getContractFactory(
      "MockSplitMain"
    )) as MockSplitMain__factory;
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    const SplitFactory = await ethers.getContractFactory("SplitFactory");

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    const splits = await MockSplitMain.deploy();
    factory = (await SplitFactory.deploy(
      nodeRegistry.address,
      splits.address
    )) as SplitFactory;
    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);
    createNode = createCreateNode(accounts, nodeRegistry);

    // standard setup
    await accountRegistry.createAccount(a0, "");
    await createNode({ owner: 1 });
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  // ---
  // cases
  // ---

  const PERCENTAGE = 1e6;

  const deploy = async () => {
    const trx = await factory.createSplit(
      [a2, a1, a3].sort() /* 0xSplits requires addresses are sorted */,
      [PERCENTAGE * 0.2, PERCENTAGE * 0.3, PERCENTAGE * 0.5],
      0,
      1,
      "metadata"
    );
    const done = await trx.wait();
    const splitAddress = done.events?.[0].args?.split;
    return splitAddress;
  };

  describe("split creation", () => {
    it("should deploy a split", async () => {
      const split = await deploy();
      expect(split).to.not.be.empty;
    });
    it("should revert if attempting to deploy a split for an unmanaged node", async () => {
      await expect(
        factory.connect(accounts[1]).createSplit(
          [a2, a1, a3].sort() /* 0xSplits requires addresses are sorted */,
          [PERCENTAGE * 0.2, PERCENTAGE * 0.3, PERCENTAGE * 0.5],
          0,
          1, // node 1 is owned by a0, not a1
          "metadata"
        )
      ).to.be.revertedWith("NotAuthorized");
    });
  });

  describe("resource manager interface", async () => {
    it("should allow broadcasting", async () => {
      const split = await deploy();
      await factory.broadcast(split, "topic", "message");
    });
    it("should revert if attempting to broadcast on an unmanaged resource", async () => {
      const split = await deploy();
      await expect(
        factory.connect(accounts[1]).broadcast(split, "topic", "message")
      ).to.be.revertedWith("NotAuthorized");
    });
  });
});
