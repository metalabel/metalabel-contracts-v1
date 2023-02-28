import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  AccountRegistry,
  NodeRegistry,
  MockSplitMain__factory,
  MockWaterfallModuleFactory__factory,
  RevenueModuleFactory,
} from "../typechain-types";
import { expect } from "chai";
import { constants } from "ethers";
import { parseUnits } from "ethers/lib/utils";

const { loadFixture } = waffle;

describe("RevenueModuleFactory.sol", () => {
  // ---
  // fixtures
  // ---

  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let factory: RevenueModuleFactory;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;

  async function fixture() {
    const MockSplitMain = (await ethers.getContractFactory(
      "MockSplitMain"
    )) as MockSplitMain__factory;
    const MockWaterfallModuleFactory = (await ethers.getContractFactory(
      "MockWaterfallModuleFactory"
    )) as MockWaterfallModuleFactory__factory;
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    const RevenueModuleFactory = await ethers.getContractFactory(
      "RevenueModuleFactory"
    );

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    const splits = await MockSplitMain.deploy();
    const waterfalls = await MockWaterfallModuleFactory.deploy();
    factory = (await RevenueModuleFactory.deploy(
      nodeRegistry.address,
      splits.address,
      waterfalls.address
    )) as RevenueModuleFactory;

    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);

    // standard setup
    await accountRegistry.createAccount(a0, ""); // 1
    await nodeRegistry.createNode(1, 1, 0, 0, [], ""); // 1
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  // ---
  // cases
  // ---

  const PERCENTAGE = 1e6;

  const getDeployConfig = () => {
    return {
      token: constants.AddressZero,
      waterfallRecipients: [a1, a2],
      waterfallThresholds: [parseUnits("1"), parseUnits("0.5")],
      splitRecipients: [
        a1,
        a2,
        a3,
      ].sort() /* 0xSplits requires addresses are sorted */,
      splitPercentAllocations: [
        PERCENTAGE * 0.2,
        PERCENTAGE * 0.3,
        PERCENTAGE * 0.5,
      ],
      splitDistributorFee: 0,
      controlNodeId: 1,
      metadata: "",
    };
  };

  describe("revenue module creation", () => {
    it("should deploy a split+waterfall", async () => {
      await factory.deployRevenueModule(getDeployConfig());
    });
    it("should deploy a split", async () => {
      await factory.deployRevenueModule({
        ...getDeployConfig(),
        waterfallRecipients: [],
        waterfallThresholds: [],
      });
    });
    it("should deploy a waterfall", async () => {
      await factory.deployRevenueModule({
        ...getDeployConfig(),
        splitRecipients: [],
        splitPercentAllocations: [],
      });
    });
    it("should revert if not deploying a split or waterfall", async () => {
      await expect(
        factory.deployRevenueModule({
          ...getDeployConfig(),
          waterfallRecipients: [],
          waterfallThresholds: [],
          splitRecipients: [],
          splitPercentAllocations: [],
        })
      ).to.be.revertedWith("InvalidConfiguration");
    });
    it("should revert if attempting to deploy a split for an unmanaged node", async () => {
      await expect(
        factory.connect(accounts[1]).deployRevenueModule(getDeployConfig())
      ).to.be.revertedWith("NotAuthorized");
    });
  });
});
