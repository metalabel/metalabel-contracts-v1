import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import { AccountRegistry, AccountRegistry__factory } from "../typechain-types";
import { constants } from "ethers";

const { loadFixture } = waffle;

describe("AccountRegistry.sol", () => {
  // ---
  // fixtures
  // ---

  let AccountRegistry: AccountRegistry__factory;
  let registry: AccountRegistry;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;

  async function fixture() {
    AccountRegistry = (await ethers.getContractFactory(
      "AccountRegistry"
    )) as AccountRegistry__factory;
    registry = await AccountRegistry.deploy(constants.AddressZero);
    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  // ---
  // cases
  // ---

  it("should allow creating a new account", async () => {
    await registry.createAccount(a0, "");
    expect(await registry.resolveId(a0)).to.equal(1);
  });
  it("should revert if attempting to register more than one account per address", async () => {
    await registry.createAccount(a0, "");
    await expect(registry.createAccount(a0, "")).to.be.revertedWith(
      "AccountAlreadyExists"
    );
  });
  it("should allow broadcasts", async () => {
    await registry.createAccount(a0, "");
    await registry.broadcast("foo", "bar");
  });
  it("should revert if broadcasting w/o an account", async () => {
    await expect(registry.broadcast("foo", "bar")).to.be.revertedWith(
      "NoAccount"
    );
  });
  it("should allow owner to transfer account", async () => {
    await registry.createAccount(a0, "");
    await registry.transferAccount(a1);
    expect(await registry.unsafeResolveId(a0)).to.equal(0);
    expect(await registry.resolveId(a1)).to.equal(1);
  });
  it("should revert if non-account attempting to transfer", async () => {
    await expect(registry.transferAccount(a1)).to.be.revertedWith("NoAccount");
  });
  it("should revert if transfering account to address that already has account", async () => {
    await registry.createAccount(a0, "");
    await registry.createAccount(a1, "");
    await expect(registry.transferAccount(a1)).to.be.revertedWith(
      "AccountAlreadyExists"
    );
  });
  it("should revert if if non-owner attempts to authorize issuer", async () => {
    const registry = await AccountRegistry.deploy(a1);
    await expect(registry.setAccountIssuer(a0, true)).to.be.revertedWith(
      "UNAUTHORIZED"
    );
  });
  it("should revert if in trusted issuer mode and msg.sender is not authorized", async () => {
    const registry = await AccountRegistry.deploy(a0);
    await registry.setAccountIssuer(a0, true);
    await registry.createAccount(a1, ""); // no revert
    await expect(
      registry.connect(accounts[1]).createAccount(a2, "")
    ).to.be.revertedWith("NotAuthorizedAccountIssuer");
  });
});
