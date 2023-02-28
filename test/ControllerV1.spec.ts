import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
  AccountRegistry,
  CollectionFactory,
  Collection__factory,
  ControllerV1,
  DropEngineV2,
  NodeRegistry,
  Collection,
  Memberships__factory,
  MembershipsFactory,
} from "../typechain-types";
import { constants, utils } from "ethers";
import {
  createMerkleTree,
  encodeDropEngineV2Data,
  generateSequenceConfig,
} from "./_fixtures";
import { parseUnits, zeroPad } from "ethers/lib/utils";

const { loadFixture } = waffle;

describe("ControllerV1.sol", () => {
  // ---
  // fixtures
  // ---

  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let collectionFactory: CollectionFactory;
  let membershipsFactory: MembershipsFactory;
  let controllerV1: ControllerV1;
  let dropEngineV2: DropEngineV2;
  let Collection: Collection__factory;
  let Memberships: Memberships__factory;

  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;

  const getTree = () =>
    createMerkleTree(
      ["string", "address"],
      [
        ["sub1", a0],
        ["sub2", a1],
      ]
    );

  const getLaunchConfig = () => {
    return {
      collectionName: "Test Record Collection",
      collectionSymbol: "RTEST",
      collectionContractURI: "ipfs://recordContractURI",
      collectionMetadata: "record metadata",
      membershipsName: "Test Memberships Collection",
      membershipsSymbol: "MTEST",
      membershipsBaseURI: "https://metalabel.cloud/api/memberships/",
      membershipsMetadata: "memberships metadata",
      members: [],
      membershipsListRoot: utils.randomBytes(32),
    };
  };

  async function fixture() {
    // Factories
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    Collection = (await ethers.getContractFactory(
      "Collection"
    )) as Collection__factory;
    const CollectionFactory = await ethers.getContractFactory(
      "CollectionFactory"
    );
    Memberships = (await ethers.getContractFactory(
      "Memberships"
    )) as Memberships__factory;
    const MembershipsFactory = await ethers.getContractFactory(
      "MembershipsFactory"
    );
    const ControllerV1 = await ethers.getContractFactory("ControllerV1");
    const DropEngineV2 = await ethers.getContractFactory("DropEngineV2");

    // ---
    // Accounts
    // ---
    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);

    // ---
    // Deployment
    // ---

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    const collectionImplementation = await Collection.deploy();
    collectionFactory = (await CollectionFactory.deploy(
      nodeRegistry.address,
      collectionImplementation.address
    )) as CollectionFactory;
    const membershipsImplementation = await Memberships.deploy();
    membershipsFactory = (await MembershipsFactory.deploy(
      nodeRegistry.address,
      membershipsImplementation.address
    )) as MembershipsFactory;
    controllerV1 = (await ControllerV1.deploy(
      nodeRegistry.address,
      accountRegistry.address,
      collectionFactory.address,
      membershipsFactory.address,
      a0 // controller owner
    )) as ControllerV1;
    dropEngineV2 = (await DropEngineV2.deploy(
      constants.AddressZero,
      nodeRegistry.address
    )) as DropEngineV2;

    // ---
    // Setup
    // ---

    // Setup allowlist and issue account for a0 - our step
    await controllerV1.updateAllowlist(getTree().tree.getHexRoot(), [
      { subject: a0, metadata: "account metadata" },
    ]);

    // create a new metalabel node - has to come from admin - (node ID = 1)
    await nodeRegistry.createNode(
      1 /* node type */,
      1 /* admin */,
      0 /* parent */,
      0 /* group */,
      [controllerV1.address] /* ensure controllerV1 can now manage the node */,
      "metalabel metadata"
    );
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  // ---
  // cases
  // ---

  describe("launchMetalabel", () => {
    it("should allow launching a metalabel", async () => {
      const trx = await controllerV1.setupMetalabel({
        ...getLaunchConfig(),
        metalabelNodeId: 1,
        subdomain: "sub1",
        proof: getTree().createProof(["sub1", a0]),
        members: [
          { to: a2, sequenceId: 0 },
          { to: a3, sequenceId: 0 },
        ],
      });
      const mined = await trx.wait();
      {
        const event = mined.events?.[2];
        const address = event?.address ?? "";
        const collection = Collection.attach(address);
        expect(await collection.name()).to.equal("Test Record Collection");
        expect(await collection.symbol()).to.equal("RTEST");
        expect(await collection.owner()).to.equal(a0);
        expect(await collection.controlNode()).to.equal(1);
      }
      {
        const event = mined.events?.[4];
        const address = event?.address ?? "";
        const mcollection = Memberships.attach(address);
        expect(await mcollection.name()).to.equal(
          "Test Memberships Collection"
        );
        expect(await mcollection.symbol()).to.equal("MTEST");
        expect(await mcollection.owner()).to.equal(a0);
        expect(await mcollection.controlNode()).to.equal(1);
        expect(await mcollection.totalSupply()).to.equal(2);
        expect(await mcollection.balanceOf(a2)).to.equal(1);
        expect(await mcollection.balanceOf(a3)).to.equal(1);
      }
    });
    it("should allow setting up without a memberships contract", async () => {
      const trx = await controllerV1.setupMetalabel({
        ...getLaunchConfig(),
        metalabelNodeId: 1,
        subdomain: "sub1",
        proof: getTree().createProof(["sub1", a0]),
        membershipsListRoot: zeroPad("0x00", 32),
      });
      const mined = await trx.wait();
      {
        const event = mined.events?.[2];
        const address = event?.address ?? "";
        const collection = Collection.attach(address);
        expect(await collection.name()).to.equal("Test Record Collection");
        expect(await collection.symbol()).to.equal("RTEST");
        expect(await collection.owner()).to.equal(a0);
        expect(await collection.controlNode()).to.equal(1);
      }
      {
        const event = mined.events?.[4];
        const address = event?.address ?? "";
        // there was no event at index 4 since we did not deploy a memberships contract
        expect(address).to.equal("");
      }
    });
    it("should revert if invalid subdomain", async () => {
      await expect(
        controllerV1.setupMetalabel({
          ...getLaunchConfig(),
          metalabelNodeId: 1,
          subdomain: "bad",
          proof: getTree().createProof(["sub1", a0]),
        })
      ).to.be.revertedWith("InvalidProof");
    });
    it("should revert if msg.sender cannot manage metalabel", async () => {
      await accountRegistry.createAccount(a1, ""); // 2
      await nodeRegistry.startNodeOwnerTransfer(1, 2);
      await nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(1);
      await expect(
        controllerV1.setupMetalabel({
          ...getLaunchConfig(),
          metalabelNodeId: 1,
          subdomain: "sub1",
          proof: getTree().createProof(["sub1", a0]),
        })
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should revert if msg.sender is not allowlisted admin", async () => {
      await expect(
        controllerV1.connect(accounts[1]).setupMetalabel({
          ...getLaunchConfig(),
          metalabelNodeId: 1,
          subdomain: "sub1",
          proof: getTree().createProof(["sub1", a0]),
        })
      ).to.be.revertedWith("InvalidProof");
    });
    it("should revert if attempting to setup the same metalabel more than once", async () => {
      await controllerV1.setupMetalabel({
        ...getLaunchConfig(),
        metalabelNodeId: 1,
        subdomain: "sub1",
        proof: getTree().createProof(["sub1", a0]),
      });
      await expect(
        controllerV1.setupMetalabel({
          ...getLaunchConfig(),
          metalabelNodeId: 1,
          subdomain: "sub1",
          proof: getTree().createProof(["sub1", a0]),
        })
      ).to.be.revertedWith("SubdomainAlreadyReserved");
    });
  });
  describe("publishRelease", () => {
    let collection: Collection;
    beforeEach(async () => {
      const trx = await controllerV1.setupMetalabel({
        ...getLaunchConfig(),
        metalabelNodeId: 1,
        subdomain: "sub1",
        proof: getTree().createProof(["sub1", a0]),
      });
      const mined = await trx.wait();
      const event = mined.events?.[2];
      const address = event?.address ?? "";
      collection = Collection.attach(address);
    });

    it("should publish a release", async () => {
      await controllerV1.publishRelease({
        metalabelNodeId: 1,
        releaseMetadata: "release metadata",
        recordCollection: collection.address,
        sequences: [
          {
            sequenceData: generateSequenceConfig(dropEngineV2.address),
            engineData: encodeDropEngineV2Data(parseUnits("0.05"), 0, a0),
          },
        ],
      });

      // test mint
      expect(await collection.balanceOf(a0)).to.equal(0);
      await dropEngineV2.mint(collection.address, 1, 1, {
        value: parseUnits("0.05"),
      });
      expect(await collection.balanceOf(a0)).to.equal(1);
    });
    it("should revert if msg.sender cannot manage metalabel", async () => {
      await accountRegistry.createAccount(a1, ""); // 2
      await nodeRegistry.startNodeOwnerTransfer(1, 2);
      await nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(1);
      await expect(
        controllerV1.publishRelease({
          metalabelNodeId: 1,
          releaseMetadata: "release metadata",
          recordCollection: collection.address,
          sequences: [
            {
              sequenceData: generateSequenceConfig(dropEngineV2.address),
              engineData: encodeDropEngineV2Data(parseUnits("0.05"), 0, a0),
            },
          ],
        })
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should revert if msg.sender cannot manage record collection control node", async () => {
      // create a new account for a1 and a new metalabel node owned by it
      await accountRegistry.createAccount(a1, ""); // 2
      await nodeRegistry
        .connect(accounts[1])
        .createNode(1, 2, 0, 0, [controllerV1.address], ""); // 2

      const trx = await collectionFactory
        .connect(accounts[1])
        .createCollection({
          controlNodeId: 2,
          contractURI: "",
          metadata: "",
          name: "name",
          symbol: "symbol",
          owner: a1,
        });
      const mined = await trx.wait();
      const event = mined.events?.[1];
      const address = event?.address ?? "";
      const collection = Collection.attach(address);
      await expect(
        controllerV1.publishRelease({
          metalabelNodeId: 1,
          releaseMetadata: "release metadata",
          recordCollection: collection.address,
          sequences: [
            {
              sequenceData: generateSequenceConfig(dropEngineV2.address),
              engineData: encodeDropEngineV2Data(parseUnits("0.05"), 0, a0),
            },
          ],
        })
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should always use the newly created release node as the dropNodeId for the sequence", async () => {
      // create a new account for a1 and a new metalabel node owned by it
      await accountRegistry.createAccount(a1, ""); // 2
      await nodeRegistry
        .connect(accounts[1])
        .createNode(1, 2, 0, 0, [controllerV1.address], ""); // 2

      await controllerV1.publishRelease({
        metalabelNodeId: 1,
        releaseMetadata: "release metadata",
        recordCollection: collection.address,
        sequences: [
          {
            sequenceData: {
              ...generateSequenceConfig(dropEngineV2.address),
              dropNodeId: 2, // this will be overwrriten
            },
            engineData: encodeDropEngineV2Data(parseUnits("0.05"), 0, a0),
          },
        ],
      });

      // new release node is id = 3

      const info = await collection.getSequenceData(1);
      expect(info.dropNodeId).to.equal("3");
    });
  });
});
