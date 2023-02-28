import { ethers, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import range from "lodash/range";

import {
  AccountRegistry,
  Collection,
  CollectionFactory,
  Collection__factory,
  MockMinterV2,
  DropEngineV2,
  NodeRegistry,
  DropEngineV2__factory,
  MockBrokenRecipient,
} from "../typechain-types";
import { BigNumber, constants, utils } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import {
  createCreateCollectionConfig,
  encodeDropEngineV2Data,
  parseBase64,
} from "./_fixtures";

const { loadFixture } = waffle;

describe("DropEngineV2.sol", () => {
  // ---
  // fixtures
  // ---

  let Collection: Collection__factory;
  let dropEngine: DropEngineV2;
  let accountRegistry: AccountRegistry;
  let nodeRegistry: NodeRegistry;
  let factory: CollectionFactory;
  let accounts: SignerWithAddress[];
  let DropEngineV2: DropEngineV2__factory;
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
    DropEngineV2 = (await ethers.getContractFactory(
      "DropEngineV2"
    )) as DropEngineV2__factory;

    accountRegistry = (await AccountRegistry.deploy(
      constants.AddressZero
    )) as AccountRegistry;
    nodeRegistry = (await NodeRegistry.deploy(
      accountRegistry.address
    )) as NodeRegistry;
    dropEngine = (await DropEngineV2.deploy(
      constants.AddressZero,
      nodeRegistry.address
    )) as DropEngineV2;
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

  describe("DropEngineV2.sol", () => {
    it("should allow configuring a drop", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 500, a1)
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
    });
    it("should allow minting", async () => {
      const collection = await createCollection();
      const price = parseUnits("0.01");
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(price, 500, recipient)
      );
      await dropEngine.mint(collection.address, 1, 1, { value: price });
      await dropEngine.mint(collection.address, 1, 1, { value: price });
      await dropEngine.mint(collection.address, 1, 1, { value: price });
      await dropEngine.mint(collection.address, 1, 1, { value: price });
      await dropEngine.mint(collection.address, 1, 1, { value: price });
      const parsed1 = parseBase64(await collection.tokenURI(1));
      const parsed2 = parseBase64(await collection.tokenURI(2));
      expect(parsed1.name).to.equal("name1 1/10000");
      expect(parsed2.name).to.equal("name2 2/10000");

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
    it("should allow pseudo-randmom variant selection", async () => {
      const collection = await createCollection();
      const price = parseUnits("0.01");
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(price, 500, recipient, {
          randomizeMetadataVariants: true,
          maxRecordsPerTransaction: 20,
        })
      );
      await dropEngine.mint(collection.address, 1, 20, {
        value: price.mul(20),
      });
      const uris = await Promise.all(
        range(1, 21).map((i) => collection.tokenURI(i))
      );
      const variants = uris.map(
        (uri) => parseBase64(uri).metalabel.record_variant_name
      );

      // if its random, there's likely at least one set of adjacent records that
      // have the same variant. Works (1-2^20) percent of the time lmao
      const adjacent = variants.find((v, i) => v === variants[i + 1]);
      expect(adjacent).to.not.be.undefined;
    });
    it("should include edition number in name and attribute", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig(), maxSupply: 0 /* open edition */ },
        encodeDropEngineV2Data(BigNumber.from(0), 0, constants.AddressZero)
      );
      await dropEngine.mint(collection.address, 1, 1);
      await dropEngine.mint(collection.address, 1, 1);
      await dropEngine.mint(collection.address, 1, 1);
      const metadata1 = parseBase64(await collection.tokenURI(1));
      const metadata2 = parseBase64(await collection.tokenURI(2));
      const metadata3 = parseBase64(await collection.tokenURI(3));
      expect(metadata1.name).to.equal("name1 1");
      expect(metadata2.name).to.equal("name2 2");
      expect(metadata3.name).to.equal("name1 3");
      expect(metadata1.attributes[0].value).to.equal("1");
      expect(metadata2.attributes[0].value).to.equal("2");
      expect(metadata3.attributes[0].value).to.equal("3");
    });
    it("should include total supply count if limited edition", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig(), maxSupply: 100 /* limited edition */ },
        encodeDropEngineV2Data(BigNumber.from(0), 0, constants.AddressZero)
      );
      await dropEngine.mint(collection.address, 1, 1);
      await dropEngine.mint(collection.address, 1, 1);
      const metadata1 = parseBase64(await collection.tokenURI(1));
      const metadata2 = parseBase64(await collection.tokenURI(2));
      expect(metadata1.name).to.equal("name1 1/100");
      expect(metadata2.name).to.equal("name2 2/100");
      expect(metadata1.attributes[0].value).to.equal("1/100");
      expect(metadata2.attributes[0].value).to.equal("2/100");
    });
    it("should properly represent all onchain metadata", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig(), maxSupply: 0 /* open edition */ },
        encodeDropEngineV2Data(BigNumber.from(0), 0, constants.AddressZero)
      );
      await dropEngine.mint(collection.address, 1, 1);
      const metadata1 = parseBase64(await collection.tokenURI(1));
      expect(metadata1).to.deep.equal({
        name: "name1 1",
        description: "description",
        image: "image",
        external_url: "https://metalabel.xyz",
        metalabel: {
          node_registry_address: nodeRegistry.address.toLowerCase(),
          record_variant_name: "Variant 1",
          release_metadata_uri: "ipfs://hash",
          record_contents: [1, 2, 3],
        },
        attributes: [
          { trait_type: "Record Edition", value: "1" },
          { trait_type: "Record Variant", value: "Variant 1" },
          { trait_type: "foo", value: "bar1" },
          { trait_type: "bar", value: "baz1" },
        ],
      });
    });
    it("should revert if underpaying", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 500, a1)
      );

      // underpay
      await expect(
        dropEngine.mint(collection.address, 1, 1)
      ).to.be.revertedWith("IncorrectPaymentAmount");
    });
    it("should refund any overpay amount", async () => {
      const collection = await createCollection();
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 500, recipient)
      );

      // overpay
      await dropEngine.mint(collection.address, 1, 1, {
        value: parseUnits("1"),
      });

      expect(await dropEngine.provider.getBalance(recipient)).to.equal(
        parseUnits("0.01")
      );
    });
    it("should allow for free drops", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(BigNumber.from(0), 500, constants.AddressZero)
      );
      await dropEngine.mint(collection.address, 1, 1);
      await dropEngine.mint(collection.address, 1, 1);
      await dropEngine.mint(collection.address, 1, 1);
    });
    it("should revert if recipient is provided when price is zero", async () => {
      const collection = await createCollection();
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineV2Data(BigNumber.from(0), 500, a0)
        )
      ).to.be.revertedWith("InvalidPriceOrRecipient");
    });
    it("should revert if recipient is missing when price is non-zero", async () => {
      const collection = await createCollection();
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineV2Data(parseUnits("0.01"), 500, constants.AddressZero)
        )
      ).to.be.revertedWith("InvalidPriceOrRecipient");
    });
    it("should revert if mint comes from a smart contract", async () => {
      const MockMinterV2 = await ethers.getContractFactory("MockMinterV2");
      const minter = (await MockMinterV2.deploy()) as MockMinterV2;
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(BigNumber.from(0), 0, constants.AddressZero)
      );
      await dropEngine.mint(collection.address, 1, 1); // ensure works
      await expect(
        minter.mint(dropEngine.address, collection.address, 1, 1)
      ).to.be.revertedWith("MinterMustBeEOA");
    });
    it("should not revert if allowContractMints is set", async () => {
      const MockMinterV2 = await ethers.getContractFactory("MockMinterV2");
      const minter = (await MockMinterV2.deploy()) as MockMinterV2;
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(BigNumber.from(0), 0, constants.AddressZero, {
          allowContractMints: true,
        })
      );
      await dropEngine.mint(collection.address, 1, 1); // ensure works
      // no revert
      minter.mint(dropEngine.address, collection.address, 1, 1);
    });
    it("should transfer correct ETH when purchasing multiple in same trx", async () => {
      const collection = await createCollection();
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 0, recipient, {
          maxRecordsPerTransaction: 10,
        })
      );
      await dropEngine.mint(collection.address, 1, 5, {
        value: parseUnits("0.05"),
      });
      expect(await collection.provider.getBalance(recipient)).to.equal(
        parseUnits("0.05")
      );
    });
    it("should revert if attempting more than max per trx limit", async () => {
      const collection = await createCollection();
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 0, recipient, {
          maxRecordsPerTransaction: 3,
        })
      );
      await expect(
        dropEngine.mint(collection.address, 1, 5, {
          value: parseUnits("0.05"),
        })
      ).to.be.revertedWith("InvalidMintAmount");
    });
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
      encodeDropEngineV2Data(price, 500, mock.address, {
        maxRecordsPerTransaction: 1,
      })
    );
    await expect(
      dropEngine.mint(collection.address, 1, 1, { value: price })
    ).to.be.revertedWith("CouldNotTransferEth");
  });
  it("should revert if refund cannot be sent back to msg.sender", async () => {
    const collection = await createCollection();
    const price = parseUnits("0.01");
    const MockBrokenRecipient = await ethers.getContractFactory(
      "MockBrokenRecipient"
    );
    const mock = (await MockBrokenRecipient.deploy()) as MockBrokenRecipient;
    const recipient = utils.hexlify(utils.randomBytes(20));

    await collection.configureSequence(
      { ...seqConfig() },
      encodeDropEngineV2Data(price, 500, recipient, {
        maxRecordsPerTransaction: 1,
        allowContractMints: true,
      })
    );

    await expect(
      mock.mintOnDropEngineV2(dropEngine.address, collection.address, 1, 1, {
        value: parseUnits("1"),
      })
    ).to.be.revertedWith("CouldNotTransferEth");
  });
  it("should revert if royalty bps is too high", async () => {
    const collection = await createCollection();
    // no revert
    await collection.configureSequence(
      { ...seqConfig() },
      encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
        maxRecordsPerTransaction: 1,
      })
    );
    await expect(
      collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 10001, a1, {
          maxRecordsPerTransaction: 1,
        })
      )
    ).to.be.revertedWith("InvalidRoyaltyBps");
  });

  describe("primary sale fees", () => {
    it("should retain the primary sales fee in the contract balance on record mint", async () => {
      const collection = await createCollection();
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      await engine.setPrimarySaleFeeBps(1000);

      const price = parseUnits("0.03");
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig(), engine: engine.address },
        encodeDropEngineV2Data(price, 500, recipient, {
          primarySaleFeeBps: 1000,
          maxRecordsPerTransaction: 10,
        })
      );

      await engine.mint(collection.address, 1, 3, {
        value: parseUnits("0.09"),
      });

      expect(await collection.provider.getBalance(engine.address)).to.equal(
        parseUnits("0.009")
      );
      expect(await collection.provider.getBalance(recipient)).to.equal(
        parseUnits("0.081")
      );
    });
    it("should revert if non-owner attempts to set protocol fee", async () => {
      await expect(dropEngine.setPrimarySaleFeeBps(100)).to.be.revertedWith(
        "UNAUTHORIZED"
      );
    });
    it("should revert if protocol fee is set above 100%", async () => {
      // no revert
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      await engine.setPrimarySaleFeeBps(10000);
      await expect(engine.setPrimarySaleFeeBps(10001)).to.be.revertedWith(
        "InvalidPrimarySaleFee"
      );
    });
    it("should revert if protocol fee in configuration does not match protocol fee", async () => {
      const collection = await createCollection();
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      const price = parseUnits("0.03");
      const recipient = utils.hexlify(utils.randomBytes(20));

      await engine.setPrimarySaleFeeBps(500);

      await expect(
        collection.configureSequence(
          { ...seqConfig(), engine: engine.address },
          encodeDropEngineV2Data(price, 500, recipient, {
            primarySaleFeeBps: 1000,
          })
        )
      ).to.be.revertedWith("InvalidPrimarySaleFee");

      // no revert
      await collection.configureSequence(
        { ...seqConfig(), engine: engine.address },
        encodeDropEngineV2Data(price, 500, recipient, {
          primarySaleFeeBps: 500,
        })
      );
    });
    it("should retain original fee amount if protocol fee changes after configured drop", async () => {
      const collection = await createCollection();
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      await engine.setPrimarySaleFeeBps(1000);

      const price = parseUnits("0.03");
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig(), engine: engine.address },
        encodeDropEngineV2Data(price, 500, recipient, {
          primarySaleFeeBps: 1000,
          maxRecordsPerTransaction: 10,
        })
      );

      // future fee is now zero, but the original fee is still retained for sequence
      await engine.setPrimarySaleFeeBps(0);

      await engine.mint(collection.address, 1, 3, {
        value: parseUnits("0.09"),
      });

      expect(await collection.provider.getBalance(engine.address)).to.equal(
        parseUnits("0.009")
      );
      expect(await collection.provider.getBalance(recipient)).to.equal(
        parseUnits("0.081")
      );
    });
    it("should allow owner to set primary sales fee", async () => {
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      expect(await engine.primarySaleFeeBps()).to.equal(0);
      await engine.setPrimarySaleFeeBps(1000);
      expect(await engine.primarySaleFeeBps()).to.equal(1000);
    });
    it("it should allow permissionless withdrawal of fees to owner account", async () => {
      const collection = await createCollection();
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      await engine.setPrimarySaleFeeBps(1000);
      const price = parseUnits("0.01");
      const recipient = utils.hexlify(utils.randomBytes(20));
      await collection.configureSequence(
        { ...seqConfig(), engine: engine.address },
        encodeDropEngineV2Data(price, 500, recipient, {
          primarySaleFeeBps: 1000,
          maxRecordsPerTransaction: 10,
        })
      );
      await engine.mint(collection.address, 1, 3, {
        value: parseUnits("0.03"),
      });

      expect(await collection.provider.getBalance(engine.address)).to.equal(
        parseUnits("0.003")
      );
      await engine.connect(accounts[1]).transferFeesToOwner();
      expect(await collection.provider.getBalance(engine.address)).to.equal(
        "0"
      );
    });
    it("should revert if unable to properly withdraw fees", async () => {
      const MockBrokenRecipient = await ethers.getContractFactory(
        "MockBrokenRecipient"
      );
      const mock = await MockBrokenRecipient.deploy();
      const collection = await createCollection();
      const engine = await DropEngineV2.deploy(a0, nodeRegistry.address);
      await engine.setPrimarySaleFeeBps(1000);
      await engine.transferOwnership(mock.address);
      const price = parseUnits("0.01");
      const recipient = utils.hexlify(utils.randomBytes(20));

      await collection.configureSequence(
        { ...seqConfig(), engine: engine.address },
        encodeDropEngineV2Data(price, 500, recipient, {
          primarySaleFeeBps: 1000,
          maxRecordsPerTransaction: 10,
        })
      );

      await engine.mint(collection.address, 1, 3, {
        value: parseUnits("0.03"),
      });

      await expect(engine.transferFeesToOwner()).to.be.revertedWith(
        "CouldNotTransferEth"
      );
    });
  });

  describe("price decay mechanic", () => {
    const mineNextBlock = () => ethers.provider.send("evm_mine", []);
    const setAutomine = (set = true) =>
      ethers.provider.send("evm_setAutomine", [set]);
    const increaseTimestampAndMineNextBlock = async (
      offsetInSeconds: number
    ) => {
      await ethers.provider.send("evm_increaseTime", [offsetInSeconds]);
      await mineNextBlock();
    };
    const currentTimestamp = async () => {
      const blockNumber = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNumber);
      return block.timestamp;
    };

    afterEach(() => setAutomine(true));

    it("current price should be final price if after decay stop time", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("1"), 10000, a1, {
          decayStopTimestamp: (await currentTimestamp()) + 60 * 60 * 24 * 100, // stops in 100 days
          priceDecayPerDay: parseUnits("1"), // 1 ETH per day
        })
      );
      await setAutomine(false);

      await mineNextBlock();

      // price should be 1 ETH + ~100 days * 1 ETH = ~101 ETH
      // checking > 100 and < 102 to account for timing around the tests
      expect(
        (await dropEngine.currentPrice(collection.address, 1)).gt(
          parseUnits("100")
        )
      ).to.be.true;
      expect(
        (await dropEngine.currentPrice(collection.address, 1)).lt(
          parseUnits("102")
        )
      ).to.be.true;

      // fast forward 100 days
      await increaseTimestampAndMineNextBlock(60 * 60 * 24 * 101); // 1 day past decay time
      expect(await dropEngine.currentPrice(collection.address, 1)).to.equal(
        parseUnits("1")
      );
    });

    it("current price should decrease over time", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("1"), 10000, a1, {
          decayStopTimestamp: (await currentTimestamp()) + 60 * 60 * 24 * 100, // stops in 100 days
          priceDecayPerDay: parseUnits("1"), // 1 ETH per day
        })
      );
      await setAutomine(false);

      const price = async () => dropEngine.currentPrice(collection.address, 1);

      // price should be 1 ETH + ~100 days * 1 ETH = ~101 ETH
      // checking > 100 and < 102 to account for timing around the tests
      expect((await price()).gt(parseUnits("100"))).to.be.true;
      expect((await price()).lt(parseUnits("102"))).to.be.true;

      await increaseTimestampAndMineNextBlock(60 * 60 * 24 * 10); // 10 days
      expect((await price()).gt(parseUnits("90"))).to.be.true;
      expect((await price()).lt(parseUnits("92"))).to.be.true;

      await increaseTimestampAndMineNextBlock(60 * 60 * 24 * 10); // 10 days
      expect((await price()).gt(parseUnits("80"))).to.be.true;
      expect((await price()).lt(parseUnits("82"))).to.be.true;

      await increaseTimestampAndMineNextBlock(60 * 60 * 24 * 70); // 70 days
      expect((await price()).gt(parseUnits("10"))).to.be.true;
      expect((await price()).lt(parseUnits("12"))).to.be.true;

      await increaseTimestampAndMineNextBlock(60 * 60 * 24 * 10); // 10 days
      expect((await price()).gt(parseUnits("0"))).to.be.true;
      expect((await price()).lt(parseUnits("2"))).to.be.true;
    });

    it("should revert if decay stop time is in the past", async () => {
      const collection = await createCollection();
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
          decayStopTimestamp: 0, // okay to use zero
        })
      );
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
            decayStopTimestamp: 1000, // not okay
          })
        )
      ).to.be.revertedWith("InvalidPriceDecayConfig");
    });
    it("should revert if decay time is set but not decay per day, and vice versa", async () => {
      const collection = await createCollection();
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
            decayStopTimestamp: Math.round(Date.now() / 1000 + 60 * 60),
            priceDecayPerDay: "0",
          })
        )
      ).to.be.revertedWith("InvalidPriceDecayConfig");
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
            decayStopTimestamp: "0",
            priceDecayPerDay: "100",
          })
        )
      ).to.be.revertedWith("InvalidPriceDecayConfig");
    });
    it("should revert if no revenue recipient for a free drop but price decay is set", async () => {
      const collection = await createCollection();
      await expect(
        collection.configureSequence(
          { ...seqConfig() },
          encodeDropEngineV2Data(
            parseUnits("0.00"),
            10000,
            constants.AddressZero,
            {
              decayStopTimestamp: (await currentTimestamp()) + 60 * 60 * 24, // stops in 1 days
              priceDecayPerDay: "1",
            }
          )
        )
      ).to.be.revertedWith("InvalidPriceOrRecipient");

      // no revert
      await collection.configureSequence(
        { ...seqConfig() },
        encodeDropEngineV2Data(parseUnits("0.00"), 10000, a1, {
          decayStopTimestamp: (await currentTimestamp()) + 60 * 60 * 24, // stops in 1 days
          priceDecayPerDay: "1",
        })
      );
    });
    it("should revert if price decay stop is before mint window opens", async () => {
      const collection = await createCollection();
      const start = (await currentTimestamp()) + 60 * 60 * 24 * 2; // 2 days

      await expect(
        collection.configureSequence(
          { ...seqConfig(), sealedBeforeTimestamp: start },
          encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
            decayStopTimestamp: start - 60 * 60 * 24, // stop decay 1 day before open
            priceDecayPerDay: "1",
          })
        )
      ).to.be.revertedWith("InvalidPriceDecayConfig");

      // no revert
      await collection.configureSequence(
        { ...seqConfig(), sealedBeforeTimestamp: start },
        encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
          decayStopTimestamp: start + 60 * 60 * 24, // stop decay 1 day after open
          priceDecayPerDay: "1",
        })
      );
    });
    it("should revert if price decay stop is after mint window closes", async () => {
      const collection = await createCollection();
      const stop = (await currentTimestamp()) + 60 * 60 * 24 * 10; // 10 days

      await expect(
        collection.configureSequence(
          { ...seqConfig(), sealedAfterTimestamp: stop },
          encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
            decayStopTimestamp: stop + 60 * 60 * 24, // stop decay 1 day after close
            priceDecayPerDay: "1",
          })
        )
      ).to.be.revertedWith("InvalidPriceDecayConfig");

      // no revert
      await collection.configureSequence(
        { ...seqConfig(), sealedAfterTimestamp: stop },
        encodeDropEngineV2Data(parseUnits("0.01"), 10000, a1, {
          decayStopTimestamp: stop - 60 * 60 * 24, // stop decay 1 day before close
          priceDecayPerDay: "1",
        })
      );
    });
  });
});
