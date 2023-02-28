import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
  AccountRegistry,
  Collection,
  CollectionFactory,
  Collection__factory,
  MockMinter,
  DropEngine,
  NodeRegistry,
} from "../typechain-types";
import { BigNumber, constants, utils } from "ethers";
import { defaultAbiCoder, parseUnits } from "ethers/lib/utils";
import { createCreateCollectionConfig } from "./_fixtures";

const { loadFixture } = waffle;

describe("DropEngine.sol", () => {
  // ---
  // fixtures
  // ---

  let Collection: Collection__factory;
  let dropEngine: DropEngine;
  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let factory: CollectionFactory;
  let accounts: SignerWithAddress[];
  let a0: string, a1: string, a2: string, a3: string;

  async function fixture() {
    Collection = (await ethers.getContractFactory(
      "Collection"
    )) as Collection__factory;
    const AccountRegistry = await ethers.getContractFactory("AccountRegistry");
    const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
    const CollectionFactory = await ethers.getContractFactory(
      "CollectionFactory"
    );
    const DropEngine = await ethers.getContractFactory("DropEngine");

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    dropEngine = (await DropEngine.deploy()) as DropEngine;
    const implementation = await Collection.deploy();
    factory = (await CollectionFactory.deploy(
      nodeRegistry.address,
      implementation.address
    )) as CollectionFactory;

    accounts = await ethers.getSigners();
    [a0, a1, a2, a3] = accounts.map((a) => a.address);

    // standard setup
    await accountRegistry.createAccount(a0, "");
    await nodeRegistry.createNode(1, 1, 0, 0, [], "metalabel 1");
  }

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  const createCollection = async (
    name = "Test",
    symbol = "TEST",
    controlNodeId = 1,
    owner = a0
  ): Promise<Collection> => {
    const trx = await factory.createCollection({
      ...createCreateCollectionConfig(),
      name,
      symbol,
      controlNodeId,
      owner,
    });

    const mined = await trx.wait();
    const address = mined.events?.[2].args?.collection;
    const collection = Collection.attach(address);
    return collection;
  };

  const seqConfig = () => {
    return {
      dropNodeId: 1,
      engine: dropEngine.address,
      sealedAfterTimestamp: 0,
      sealedBeforeTimestamp: 0,
      maxSupply: 10000,
      minted: 0,
    };
  };

  // ---
  // cases
  // ---

  const encodeDropEngineData = (
    price: BigNumber,
    royaltyBps: number,
    recipient: string,
    uriPrefix: string,
    mintAuthority = constants.AddressZero
  ) => {
    return defaultAbiCoder.encode(
      ["uint80", "uint16", "address", "string", "address"],
      [price, royaltyBps, recipient, uriPrefix, mintAuthority]
    );
  };

  describe("DropEngine.sol", () => {
    it("should allow configuring a drop", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(parseUnits("0.01"), 500, a1, "ipfs://Qm/")
      );
      expect((await dropEngine.drops(collection.address, 1)).price).to.equal(
        parseUnits("0.01")
      );
      expect(
        (await dropEngine.drops(collection.address, 1)).royaltyBps
      ).to.equal(500);
      expect(
        (await dropEngine.drops(collection.address, 1)).revenueRecipient
      ).to.equal(a1);
      expect(await dropEngine.baseTokenURIs(collection.address, 1)).to.equal(
        "ipfs://Qm/"
      );
    });
    it("should allow minting", async () => {
      const collection = await createCollection();
      const price = parseUnits("0.01");
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(price, 500, recipient, "ipfs://Qm/")
      );
      await dropEngine.mint(collection.address, 1, { value: price });
      await dropEngine.mint(collection.address, 1, { value: price });
      await dropEngine.mint(collection.address, 1, { value: price });
      await dropEngine.mint(collection.address, 1, { value: price });
      await dropEngine.mint(collection.address, 1, { value: price });
      expect(await collection.tokenURI(1)).to.equal("ipfs://Qm/1.json");
      expect(await collection.tokenURI(2)).to.equal("ipfs://Qm/2.json");

      expect(await collection.provider.getBalance(recipient)).to.equal(
        parseUnits("0.05")
      );
      expect(
        (await collection.royaltyInfo(1, parseUnits("1")))[0].toLowerCase()
      ).to.equal(recipient);
      expect((await collection.royaltyInfo(1, parseUnits("1")))[1]).to.equal(
        parseUnits("0.05")
      );
    });
    it("should revert if incorrect payment amount", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(parseUnits("0.01"), 500, a1, "ipfs://Qm/")
      );

      // underpay
      await expect(dropEngine.mint(collection.address, 1)).to.be.revertedWith(
        "IncorrectPaymentAmount"
      );

      // overpay
      await expect(
        dropEngine.mint(collection.address, 1, { value: parseUnits("1") })
      ).to.be.revertedWith("IncorrectPaymentAmount");
    });
    it("should revert if royalty bps is too high", async () => {
      const collection = await createCollection();
      // no revert
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(parseUnits("0.01"), 10000, a1, "ipfs://Qm/")
      );
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineData(parseUnits("0.01"), 10001, a1, "ipfs://Qm/")
        )
      ).to.be.revertedWith("InvalidRoyaltyBps");
    });
    it("should allow for free drops", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(
          BigNumber.from(0),
          500,
          constants.AddressZero,
          "ipfs://Qm/"
        )
      );
      await dropEngine.mint(collection.address, 1);
      await dropEngine.mint(collection.address, 1);
      await dropEngine.mint(collection.address, 1);
    });
    it("should revert if recipient is provided when price is zero", async () => {
      const collection = await createCollection();
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineData(BigNumber.from(0), 500, a0, "ipfs://Qm/")
        )
      ).to.be.revertedWith("InvalidPriceOrRecipient");
    });
    it("should revert if recipient is missing when price is non-zero", async () => {
      const collection = await createCollection();
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineData(
            parseUnits("0.01"),
            500,
            constants.AddressZero,
            "ipfs://Qm/"
          )
        )
      ).to.be.revertedWith("InvalidPriceOrRecipient");
    });
    it("should allow clearing permissioned mint", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(
          BigNumber.from(0),
          0,
          constants.AddressZero,
          "ipfs://Qm/",
          a0
        )
      );
      await dropEngine.permissionedMint(collection.address, 1, a1);
      expect(await collection.ownerOf(1)).to.equal(a1);
      await dropEngine.clearMintAuthority(collection.address, 1);
      await dropEngine.connect(accounts[1]).mint(collection.address, 1);
      expect(await collection.ownerOf(2)).to.equal(a1);
    });
    it("should allow permissioned mint if msg.sender is mint authority", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(
          BigNumber.from(0),
          0,
          constants.AddressZero,
          "ipfs://Qm/",
          a0
        )
      );
      await dropEngine.permissionedMint(collection.address, 1, a1);
      expect(await collection.ownerOf(1)).to.equal(a1);
    });
    it("should revert if attempting to mint a permissioned sequence if not mint authority", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(
          BigNumber.from(0),
          0,
          constants.AddressZero,
          "ipfs://Qm/",
          a0
        )
      );
      await expect(dropEngine.mint(collection.address, 1)).to.be.revertedWith(
        "PublicMintNotActive"
      );
    });
    it("should revert if attempting to do a permissioned mint if not mint authority", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(
          BigNumber.from(0),
          0,
          constants.AddressZero,
          "ipfs://Qm/",
          a1
        )
      );
      await expect(
        dropEngine.permissionedMint(collection.address, 1, a0)
      ).to.be.revertedWith("NotMintAuthority");
    });
    it("should revert if attempting to clear mint authority if not mint authority", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineData(
          BigNumber.from(0),
          0,
          constants.AddressZero,
          "ipfs://Qm/",
          a1
        )
      );
      await expect(
        dropEngine.clearMintAuthority(collection.address, 1)
      ).to.be.revertedWith("NotMintAuthority");
    });
  });
  it("should revert if mint comes from a smart contract", async () => {
    const MockMinter = await ethers.getContractFactory("MockMinter");
    const minter = (await MockMinter.deploy()) as MockMinter;
    const collection = await createCollection();
    await collection.configureSequence(
      { ...seqConfig() },
      encodeDropEngineData(
        BigNumber.from(0),
        0,
        constants.AddressZero,
        "ipfs://Qm/",
        constants.AddressZero
      )
    );
    await dropEngine.mint(collection.address, 1); // ensure works
    await expect(
      minter.mint(dropEngine.address, collection.address, 1)
    ).to.be.revertedWith("MinterMustBeEOA");
  });
  it("should revert if revenue cannot be forwarded", async () => {
    const collection = await createCollection();
    const price = parseUnits("0.01");
    const MockBrokenRecipient = await ethers.getContractFactory(
      "MockBrokenRecipient"
    );
    const mock = await MockBrokenRecipient.deploy();

    await collection.configureSequence(
      { ...seqConfig() },
      encodeDropEngineData(price, 500, mock.address, "ipfs://Qm/")
    );
    await expect(
      dropEngine.mint(collection.address, 1, { value: price })
    ).to.be.revertedWith("CouldNotTransferEth");
  });
});
