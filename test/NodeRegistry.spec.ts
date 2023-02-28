import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import { AccountRegistry, NodeRegistry } from "../typechain-types";
import { constants } from "ethers";
import { createCreateNode } from "./_fixtures";

const { loadFixture } = waffle;

describe("NodeRegistry.sol", () => {
  // ---
  // fixtures
  // ---

  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;
  let createNode: ReturnType<typeof createCreateNode>;

  async function fixture() {
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);
    createNode = createCreateNode(accounts, nodeRegistry);
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  // ---
  // cases
  // ---

  describe("createNode", () => {
    it("should allow creating a node", async () => {
      expect(await nodeRegistry.totalNodeCount()).to.equal(0);
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      expect(await nodeRegistry.totalNodeCount()).to.equal(1);
    });
    it("should allow creating child nodes", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      await createNode({ parent: 1 });
    });
    it("should revert if parent node is set to non-managemenable node", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      await expect(
        createNode({ parent: 1, owner: 2 }, accounts[1])
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
    it("should revert if group node is not manageable", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      await expect(
        createNode({ owner: 2, groupNode: 1 }, accounts[1])
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
    it("should set initial controllers", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1, intialControllers: [a1] });
      expect(await nodeRegistry.isAuthorizedAddressForNode(1, a1)).to.equal(
        true
      );
    });
    it("should revert if nodeType is zero", async () => {
      await accountRegistry.createAccount(a0, "");
      await expect(createNode({ owner: 1, nodeType: 0 })).to.be.revertedWith(
        "InvalidNodeCreate"
      );
    });
    it("should revert if msg.sender does not have an account", async () => {
      await accountRegistry.createAccount(a0, "");
      await expect(createNode({ owner: 1 }, accounts[1])).to.be.revertedWith(
        "NoAccount"
      );
    });
    it("should revert if group node is invalid", async () => {
      await accountRegistry.createAccount(a0, "");
      await expect(createNode({ owner: 1, groupNode: 10 })).to.be.revertedWith(
        "InvalidNodeCreate"
      );
    });
    it("should revert if parent node is invalid", async () => {
      await accountRegistry.createAccount(a0, "");
      await expect(createNode({ owner: 1, parent: 10 })).to.be.revertedWith(
        "InvalidNodeCreate"
      );
    });
    it("should revert if node owner does not match msg.sender", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await expect(createNode({ owner: 2 })).to.be.revertedWith(
        "NotAuthorizedForNode"
      );
    });
  });

  describe("isAuthorizedAccountForNode", () => {
    it("should return true if account owns node", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      expect(await nodeRegistry.isAuthorizedAccountForNode(1, 1)).to.equal(
        true
      );
    });
    it("should return true if account owns group node", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      await createNode({ owner: 1, groupNode: 1 });
      await nodeRegistry.startNodeOwnerTransfer(2, 2); // group owned by 1, member owned by 2
      await nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(2);
      expect(await nodeRegistry.isAuthorizedAccountForNode(2, 1)).to.equal(
        true
      );
    });
    it("should return true if account owns node, even if group node different", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      await createNode({ owner: 1, groupNode: 1 });
      await nodeRegistry.startNodeOwnerTransfer(1, 2); // group owned by 2, member owned by 1
      await nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(1);
      expect(await nodeRegistry.isAuthorizedAccountForNode(2, 1)).to.equal(
        true
      );
    });
    it("should return false if neither owner nor owner of group node", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      await createNode({ owner: 1, groupNode: 1 });
      expect(await nodeRegistry.isAuthorizedAccountForNode(2, 2)).to.equal(
        false
      );
      expect(await nodeRegistry.isAuthorizedAccountForNode(1, 2)).to.equal(
        false
      );
    });
    it("should return false if zero account is passed", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      expect(await nodeRegistry.isAuthorizedAccountForNode(1, 0)).to.equal(
        false
      );
    });
  });

  describe("isAuthorizedAddressForNode", () => {
    it("should return true if address is owner", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      expect(await nodeRegistry.isAuthorizedAddressForNode(1, a0)).to.equal(
        true
      );
    });
    it("should return true if address is group node owner", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      await createNode({ owner: 0, parent: 1, groupNode: 1 });
      expect(await nodeRegistry.isAuthorizedAddressForNode(2, a0)).to.equal(
        true
      );
    });
    it("should return true if address is authorized for own node", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      expect(await nodeRegistry.isAuthorizedAddressForNode(1, a1)).to.equal(
        false
      );
      await nodeRegistry.setController(1, a1, true);
      expect(await nodeRegistry.isAuthorizedAddressForNode(1, a1)).to.equal(
        true
      );
    });
    it("should return true if address is authorized for group node", async () => {
      await accountRegistry.createAccount(a0, "");
      await accountRegistry.createAccount(a1, "");
      await createNode({ owner: 1 });
      await createNode({ parent: 1, groupNode: 1, owner: 0 });
      expect(await nodeRegistry.isAuthorizedAddressForNode(2, a1)).to.equal(
        false
      );
      await nodeRegistry.setController(1, a1, true);
      expect(await nodeRegistry.isAuthorizedAddressForNode(2, a1)).to.equal(
        true
      );
    });
    it("should return false if node is 0", async () => {
      await accountRegistry.createAccount(a0, "");
      await createNode({ owner: 1 });
      expect(await nodeRegistry.isAuthorizedAddressForNode(0, a0)).to.equal(
        false
      );
    });
  });

  describe("startNodeOwnerTransfer", () => {
    it("should revert if non-owner attempts to set owner", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await expect(
        nodeRegistry.connect(accounts[1]).startNodeOwnerTransfer(1, 2)
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
    it("should revert if setting owner for invalid node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await expect(
        nodeRegistry.connect(accounts[1]).startNodeOwnerTransfer(2, 1)
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
    it("should revert if non-intended recipient attempts to complete transfer", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await nodeRegistry.startNodeOwnerTransfer(1, 2);
      await expect(
        nodeRegistry.completeNodeOwnerTransfer(1)
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
    it("should transfer ownership in 2-step process", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      expect(await nodeRegistry.ownerOf(1)).to.equal(1);

      await nodeRegistry.startNodeOwnerTransfer(1, 2);
      expect(await nodeRegistry.pendingNodeOwnerTransfers(1)).to.equal(2);
      expect(await nodeRegistry.ownerOf(1)).to.equal(1);

      await nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(1);
      expect(await nodeRegistry.ownerOf(1)).to.equal(2);
      expect(await nodeRegistry.pendingNodeOwnerTransfers(1)).to.equal(0);
    });
    it("should allow canceling transfer", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1

      await nodeRegistry.startNodeOwnerTransfer(1, 2);
      await nodeRegistry.startNodeOwnerTransfer(1, 0);
      expect(await nodeRegistry.pendingNodeOwnerTransfers(1)).to.equal(0);
      expect(await nodeRegistry.ownerOf(1)).to.equal(1);

      await expect(
        nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(1)
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
  });

  describe("setNodeGroupNode", () => {
    it("should allow owner setting group node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await createNode({ owner: 1 }); // 1
      await createNode({ owner: 1, groupNode: 1 }); // 2
      await createNode({ owner: 1 }); // 3
      expect(await nodeRegistry.groupNodeOf(2)).to.equal(1);
      await nodeRegistry.setNodeGroupNode(2, 3);
      expect(await nodeRegistry.groupNodeOf(2)).to.equal(3);
    });
    it("should revert if non-authorized msg.sender setting group node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await createNode({ owner: 1 }); // 2
      await expect(
        nodeRegistry.connect(accounts[1]).setNodeGroupNode(2, 1)
      ).to.be.revertedWith("NotAuthorizedForNode");
      await nodeRegistry.setNodeGroupNode(2, 1); // no revert
    });
  });

  describe("removeNodeOwner", async () => {
    it("should set node owner to 0", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await createNode({ owner: 1 }); // 1
      expect(await nodeRegistry.ownerOf(1)).to.equal(1);
      await nodeRegistry.removeNodeOwner(1);
      expect(await nodeRegistry.ownerOf(1)).to.equal(0);
    });
    it("should revert if non-owner attempts to remove owner", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await expect(
        nodeRegistry.connect(accounts[1]).removeNodeOwner(1)
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
  });

  describe("setParentNode", () => {
    it("should allow changing parent node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await createNode({ owner: 1 }); // 1
      await createNode({ owner: 1, parent: 1 }); // 2
      await createNode({ owner: 1 }); // 3
      expect(await nodeRegistry.parentOf(1)).to.equal(0);
      expect(await nodeRegistry.parentOf(2)).to.equal(1);
      await nodeRegistry.setParentNode(2, 3);
      expect(await nodeRegistry.parentOf(2)).to.equal(3);
    });
    it("should revert if attempting to change parent and not authorized to manage node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await createNode({ owner: 2 }, accounts[1]); // 2
      await createNode({ owner: 2 }, accounts[1]); // 3
      await expect(nodeRegistry.setParentNode(2, 3)).to.be.revertedWith(
        "NotAuthorizedForNode"
      );
      await nodeRegistry.connect(accounts[1]).setParentNode(2, 3); // no revert
    });
    it("should revert if attempting to change parent not authorized to manage new parent node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await createNode({ owner: 2 }, accounts[1]); // 2
      await createNode({ owner: 2 }, accounts[1]); // 3
      await expect(nodeRegistry.setParentNode(2, 3)).to.be.revertedWith(
        "NotAuthorizedForNode"
      );
    });
  });

  describe("setController", () => {
    it("should revert if msg.sender is not node owner or group owner", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await expect(
        nodeRegistry.connect(accounts[1]).setController(1, a2, true)
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
  });

  describe("broadcast", () => {
    it("should allow authorized msgsender to broadcast for node", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await createNode({ owner: 1 }); // 1
      await nodeRegistry.broadcast(1, "topic", "message");
    });
    it("should revert if non authorized msgsender attempts to broadcast", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await accountRegistry.createAccount(a1, ""); // 2
      await createNode({ owner: 1 }); // 1
      await expect(
        nodeRegistry.connect(accounts[1]).broadcast(1, "topic", "message")
      ).to.be.revertedWith("NotAuthorizedForNode");
    });
  });

  describe("node access control edge cases", () => {
    it("should not allow node ownership to be cleared by a msg.sender with no account", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await createNode({ owner: 1 }); // 1
      await expect(
        nodeRegistry.connect(accounts[1]).completeNodeOwnerTransfer(1)
      ).to.be.revertedWith("NoAccount");
    });
    it("should not allow starting node transfer by a msg.sender with no account for a node with no owner that has a group node with no owner", async () => {
      await accountRegistry.createAccount(a0, ""); // 1
      await createNode({ owner: 1 }); // 1
      await createNode({ owner: 1, groupNode: 1 }); // 2
      await nodeRegistry.removeNodeOwner(1);
      await nodeRegistry.removeNodeOwner(2);
      await expect(
        nodeRegistry.connect(accounts[1]).startNodeOwnerTransfer(2, 1234)
      ).to.be.revertedWith("NoAccount");
    });
  });
});
