import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  AccountRegistry,
  NodeRegistry,
  MockWaterfallModuleFactory__factory,
  WaterfallFactory,
} from "../typechain-types";
import { expect } from "chai";
import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { createCreateNode } from "./_fixtures";

describe("WaterfallFactory.sol", () => {
  // ---
  // fixtures
  // ---

  let MockWaterfallModuleFactory: MockWaterfallModuleFactory__factory;
  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let factory: WaterfallFactory;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;
  let createNode: ReturnType<typeof createCreateNode>;

  beforeEach(async () => {
    MockWaterfallModuleFactory = (await ethers.getContractFactory(
      "MockWaterfallModuleFactory"
    )) as MockWaterfallModuleFactory__factory;
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    const WaterfallFactory = await ethers.getContractFactory(
      "WaterfallFactory"
    );

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    const waterfalls = await MockWaterfallModuleFactory.deploy();
    factory = (await WaterfallFactory.deploy(
      nodeRegistry.address,
      waterfalls.address
    )) as WaterfallFactory;
    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);
    createNode = createCreateNode(accounts, nodeRegistry);

    // standard setup
    await accountRegistry.createAccount(a0, "");
    await createNode({ owner: 1 });
  });

  // ---
  // cases
  // ---

  const deploy = async () => {
    const trx = await factory.createWaterfall(
      constants.AddressZero /* token */,
      constants.AddressZero /* non waterfall recipient */,
      [a2, a1, a3].sort() /* 0xSplits requires addresses are sorted */,
      [parseEther("20"), parseEther("30")],
      1,
      "metadata"
    );
    const done = await trx.wait();
    const splitAddress = done.events?.[0].args?.waterfall;
    return splitAddress;
  };

  describe("split creation", () => {
    it("should deploy a split", async () => {
      const split = await deploy();
      expect(split).to.not.be.empty;
    });
    it("should revert if attempting to deploy a split for an unmanaged node", async () => {
      await expect(
        factory
          .connect(accounts[1])
          .createWaterfall(
            constants.AddressZero /* token */,
            constants.AddressZero /* non waterfall recipient */,
            [a2, a1, a3].sort() /* 0xSplits requires addresses are sorted */,
            [parseEther("20"), parseEther("30")],
            1,
            "metadata"
          )
      ).to.be.revertedWith("NotAuthorized");
    });
  });
});
