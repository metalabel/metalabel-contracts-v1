import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import {
  AccountRegistry,
  MockResource,
  NodeRegistry,
} from "../typechain-types";
import { constants } from "ethers";
import { createCreateNode } from "./_fixtures";

describe("Resource.sol", () => {
  // ---
  // fixtures
  // ---

  let resource: MockResource;
  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;
  let createNode: ReturnType<typeof createCreateNode>;

  beforeEach(async () => {
    const MockResource = await ethers.getContractFactory("MockResource");
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    resource = (await MockResource.deploy()) as MockResource;
    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);
    createNode = createCreateNode(accounts, nodeRegistry);
  });

  // ---
  // cases
  // ---

  it("should allow broadcasting", async () => {
    await accountRegistry.createAccount(a0, "");
    await createNode({ owner: 1 }); // 1
    await resource.setup(nodeRegistry.address, 1);

    await resource.broadcast("test", "message");
  });
  it("should allow broadcasting and storing", async () => {
    await accountRegistry.createAccount(a0, "");
    await createNode({ owner: 1 }); // 1
    await resource.setup(nodeRegistry.address, 1);

    await resource.broadcastAndStore("test", "message");
    expect(await resource.messageStorage("test")).to.equal("message");
  });
});
