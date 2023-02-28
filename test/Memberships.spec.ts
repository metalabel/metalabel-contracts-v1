import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
  AccountRegistry,
  NodeRegistry,
  Memberships,
  MembershipsFactory,
  Memberships__factory,
} from "../typechain-types";
import { constants } from "ethers";
import { createCreateMembershipsConfig, createMerkleTree } from "./_fixtures";
import { hexlify } from "ethers/lib/utils";

const { loadFixture } = waffle;

describe("Memberships.sol", () => {
  // ---
  // fixtures
  // ---

  let Memberships: Memberships__factory;
  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let factory: MembershipsFactory;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;

  const getTree = (
    members: Array<{ address: string; sequenceId?: number }> = []
  ) => {
    const treeInfo = createMerkleTree(
      ["address", "uint16"],
      members.map((m) => [m.address, m.sequenceId ?? 0])
    );

    return {
      ...treeInfo,
      mintsWithProofs: members.map((m) => ({
        to: m.address,
        sequenceId: m.sequenceId ?? 0,
        proof: treeInfo.createProof([m.address, m.sequenceId ?? 0]),
      })),
    };
  };

  async function fixture() {
    Memberships = (await ethers.getContractFactory(
      "Memberships"
    )) as Memberships__factory;
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    const MembershipsFactory = await ethers.getContractFactory(
      "MembershipsFactory"
    );

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    const implementation = await Memberships.deploy();
    factory = (await MembershipsFactory.deploy(
      nodeRegistry.address,
      implementation.address
    )) as MembershipsFactory;

    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);

    // standard setup
    await accountRegistry.createAccount(a0, "");
    await nodeRegistry.createNode(1, 1, 0, 0, [], "metalabel 1");
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  const createMemberships = async (
    name = "Test",
    symbol = "TEST",
    controlNodeId = 1,
    owner = a0
  ): Promise<Memberships> => {
    const trx = await factory.createMemberships({
      ...createCreateMembershipsConfig(),
      name,
      symbol,
      controlNodeId,
      owner,
    });
    const mined = await trx.wait();
    const address = mined.events?.[2].args?.memberships;
    const memberships = Memberships.attach(address);
    return memberships;
  };

  // ---
  // cases
  // ---

  describe("clone deployment", () => {
    it("deploy a clone memberships contracct", async () => {
      const memberships = await createMemberships("A", "B");
      expect(await memberships.name()).to.equal("A");
      expect(await memberships.symbol()).to.equal("B");
    });
    it("should revert if attempting to init more than once", async () => {
      const memberships = await createMemberships("A", "B");
      await expect(
        memberships.init(
          a0,
          {
            nodeRegistry: constants.AddressZero,
            controlNodeId: 0,
          },
          "",
          {
            name: "",
            symbol: "",
            baseURI: "",
          }
        )
      ).to.be.revertedWith("AlreadyInitialized");
    });
    it("should revert if attempting to init implementation", async () => {
      const memberships = Memberships.attach(await factory.implementation());
      await expect(
        memberships.init(
          a0,
          {
            nodeRegistry: constants.AddressZero,
            controlNodeId: 0,
          },
          "",
          {
            name: "",
            symbol: "",
            baseURI: "",
          }
        )
      ).to.be.revertedWith("AlreadyInitialized");
    });
    it("should revert if msg.sender not authorized to manage control node", async () => {
      await expect(createMemberships("A", "B", 2)).to.be.revertedWith(
        "NotAuthorized"
      );
    });
    it("should properly read from immutable args for node registry", async () => {
      const memberships = await createMemberships("A", "B");
      expect(await memberships.nodeRegistry()).to.equal(nodeRegistry.address);
    });
    it("should properly read from immutable args for control node", async () => {
      const memberships = await createMemberships("A", "B");
      expect(await memberships.controlNode()).to.equal(1);
    });
  });
  describe("admin functionality", () => {
    it("should allow setting owner", async () => {
      const memberships = await createMemberships();
      await memberships.setOwner(a1);
      expect(await memberships.owner()).to.equal(a1);
    });
    it("revert if non-admin attempts to set owner", async () => {
      const memberships = await createMemberships();
      await expect(
        memberships.connect(accounts[1]).setOwner(a1)
      ).to.be.revertedWith("NotAuthorized");
    });
    it("show allow setting membership root", async () => {
      const memberships = await createMemberships();
      const { tree } = getTree([{ address: a1 }]);
      await memberships.setMembershipListRoot(tree.getRoot());
      expect(await memberships.membershipListRoot()).to.equal(
        hexlify(tree.getRoot())
      );
    });
    it("should revert if non-admin attempts to set membership root", async () => {
      const memberships = await createMemberships();
      const { tree } = getTree([{ address: a1 }]);
      await expect(
        memberships.connect(accounts[1]).setMembershipListRoot(tree.getRoot())
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should allow setting a custom metadata resolver", async () => {
      const MockCustomMetadataResolver = await ethers.getContractFactory(
        "MockCustomMetadataResolver"
      );
      const mock = await MockCustomMetadataResolver.deploy();
      const memberships = await createMemberships();
      await memberships.setCustomMetadataResolver(mock.address);
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      expect(await memberships.contractURI()).to.equal("contractURI");
      expect(await memberships.tokenURI(1)).to.equal("tokenURI");
    });
    it("should revert if non-admin attempts to set metadata resolver", async () => {
      const MockCustomMetadataResolver = await ethers.getContractFactory(
        "MockCustomMetadataResolver"
      );
      const mock = await MockCustomMetadataResolver.deploy();
      const memberships = await createMemberships();
      await expect(
        memberships.connect(accounts[1]).setCustomMetadataResolver(mock.address)
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should allow for batch mint and burns", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn(
        [
          { to: a1, sequenceId: 0 },
          { to: a2, sequenceId: 0 },
        ],
        []
      );
      expect(await memberships.totalSupply()).to.equal(2);
      expect(await memberships.totalMinted()).to.equal(2);
      expect(await memberships.balanceOf(a0)).to.equal(0);
      expect(await memberships.balanceOf(a1)).to.equal(1);
      expect(await memberships.balanceOf(a2)).to.equal(1);

      await memberships.batchMintAndBurn([{ to: a3, sequenceId: 0 }], [1, 2]);
      expect(await memberships.totalSupply()).to.equal(1);
      expect(await memberships.totalMinted()).to.equal(3);
      expect(await memberships.balanceOf(a0)).to.equal(0);
      expect(await memberships.balanceOf(a1)).to.equal(0);
      expect(await memberships.balanceOf(a2)).to.equal(0);
      expect(await memberships.balanceOf(a3)).to.equal(1);
    });
    it("should revert if non-admin attempts batch mint and burn", async () => {
      const memberships = await createMemberships();
      await expect(
        memberships.connect(accounts[1]).batchMintAndBurn([], [])
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should allow updating memberships", async () => {
      const memberships = await createMemberships();

      const members = [a1, a3];
      const mints = members.map((a) => ({ to: a, sequenceId: 0 }));
      const { tree } = getTree(members.map((a) => ({ address: a })));

      await memberships.batchMintAndBurn([{ to: a0, sequenceId: 0 }], []);
      await memberships.updateMemberships(tree.getRoot(), mints, [1]);

      expect(await memberships.totalSupply()).to.equal(2);
      expect(await memberships.totalMinted()).to.equal(3);
      expect(await memberships.balanceOf(a0)).to.equal(0);
      expect(await memberships.balanceOf(a1)).to.equal(1);
      expect(await memberships.balanceOf(a3)).to.equal(1);
    });
    it("should revert if non-admin attempts to update memberships", async () => {
      const memberships = await createMemberships();
      expect(
        memberships.connect(accounts[1]).updateMemberships([], [], [])
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should revert if minting more than 1 membership to a single address", async () => {
      const memberships = await createMemberships();
      expect(
        memberships.batchMintAndBurn(
          [
            { to: a1, sequenceId: 0 },
            { to: a1, sequenceId: 0 },
          ],
          []
        )
      ).to.be.revertedWith("InvalidMint");
    });
  });
  describe("permissionless functionality", () => {
    it("should allow anyone to mint with a proof", async () => {
      const memberships = await createMemberships();

      const members = [a1, a3];
      const { tree, mintsWithProofs } = getTree(
        members.map((a) => ({ address: a, sequenceId: 420 }))
      );
      await memberships.setMembershipListRoot(tree.getRoot());

      await memberships.connect(accounts[4]).mintMemberships(mintsWithProofs);
      expect(await memberships.totalSupply()).to.equal(2);
      expect(await memberships.totalMinted()).to.equal(2);
      expect(await memberships.balanceOf(a0)).to.equal(0);
      expect(await memberships.balanceOf(a1)).to.equal(1);
      expect(await memberships.balanceOf(a3)).to.equal(1);
    });
    it("should revert if minting existing membership with proof", async () => {
      const memberships = await createMemberships();

      const members = [a1];
      const { tree, mintsWithProofs } = getTree(
        members.map((a) => ({ address: a }))
      );
      await memberships.setMembershipListRoot(tree.getRoot());
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);

      await expect(
        memberships.connect(accounts[4]).mintMemberships(mintsWithProofs)
      ).to.be.revertedWith("InvalidMint");
    });
    it("should revert if invalid mint proof", async () => {
      const memberships = await createMemberships();

      // not setting root

      const members = [a1];
      const { mintsWithProofs } = getTree(members.map((a) => ({ address: a })));
      await expect(
        memberships.connect(accounts[4]).mintMemberships(mintsWithProofs)
      ).to.be.revertedWith("InvalidMint");
    });
  });
  describe("token holder functionality", () => {
    it("should allow holder to burn", async () => {
      const memberships = await createMemberships();

      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      expect(await memberships.totalSupply()).to.equal(1);
      expect(await memberships.totalMinted()).to.equal(1);
      expect(await memberships.balanceOf(a1)).to.equal(1);

      await memberships.connect(accounts[1]).burnMembership(1);
      expect(await memberships.totalSupply()).to.equal(0);
      expect(await memberships.totalMinted()).to.equal(1);
      expect(await memberships.balanceOf(a1)).to.equal(0);
    });
    it("should revert if non-owner attempts to burn", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      await expect(memberships.burnMembership(1)).to.be.revertedWith(
        "InvalidBurn"
      );
    });
  });
  describe("transfering", () => {
    it("should revert if normal erc721 transfer is attempted", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      await expect(
        memberships.connect(accounts[1]).transferFrom(a1, a2, 1)
      ).to.be.revertedWith("TransferNotAllowed");
    });
    it("should allow admin transfer", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      expect(await memberships.balanceOf(a1)).to.equal(1);
      expect(await memberships.balanceOf(a2)).to.equal(0);
      await memberships.adminTransferFrom(a1, a2, 1);
      expect(await memberships.balanceOf(a1)).to.equal(0);
      expect(await memberships.balanceOf(a2)).to.equal(1);
    });
    it("should revert if admin attempts adminTransfer from zero address", async () => {
      const memberships = await createMemberships();
      await expect(
        memberships.adminTransferFrom(constants.AddressZero, a1, 1)
      ).to.be.revertedWith("InvalidTransfer");
    });
    it("should revert if non-admin attempts admin transfer", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      await expect(
        memberships.connect(accounts[1]).adminTransferFrom(a1, a2, 1)
      ).to.be.revertedWith("NotAuthorized");
    });
    it("should revert if transfering from wrong from", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      await expect(memberships.adminTransferFrom(a3, a2, 1)).to.be.revertedWith(
        "InvalidTransfer"
      );
    });
    it("should revert if transfering to address 0", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      await expect(
        memberships.adminTransferFrom(a1, constants.AddressZero, 1)
      ).to.be.revertedWith("InvalidTransfer");
    });
    it("should revert if to address already has a membership", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn(
        [
          { to: a1, sequenceId: 0 },
          { to: a2, sequenceId: 0 },
        ],
        []
      );
      await expect(memberships.adminTransferFrom(a1, a2, 1)).to.be.revertedWith(
        "InvalidTransfer"
      );
    });
  });
  describe("views", () => {
    it("should return name and symbol", async () => {
      const memberships = await createMemberships("foo", "bar");
      expect(await memberships.name()).to.equal("foo");
      expect(await memberships.symbol()).to.equal("bar");
    });
    it("should render tokenURI", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 0 }], []);
      expect(await memberships.tokenURI(1)).to.equal(
        `https://metalabel.cloud/api/memberships/${memberships.address.toLowerCase()}/1.json`
      );
    });
    it("should render contractURI", async () => {
      const memberships = await createMemberships();
      expect(await memberships.contractURI()).to.equal(
        `https://metalabel.cloud/api/memberships/${memberships.address.toLowerCase()}/collection.json`
      );
    });
    it("should resolve token sequence ID and mint timestmap", async () => {
      const memberships = await createMemberships();
      await memberships.batchMintAndBurn([{ to: a1, sequenceId: 123 }], []);
      expect(await memberships.tokenSequenceId(1)).to.equal(123);
      expect(Number(await memberships.tokenMintTimestamp(1))).to.be.greaterThan(
        Date.now() / 1000 - 1000
      );
    });
  });
});
