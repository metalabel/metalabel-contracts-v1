import { constants } from "ethers";
import { task } from "hardhat/config";
import { readDeploymentsFile, writeDeploymentsFile } from "./file";

task("deploy", "Deploy a contract")
  .addParam<string>("contract", "Contract to deploy")
  .setAction(async ({ contract }, { ethers, run, network }) => {
    console.log("compiling all contracts ...");
    await run("compile");

    const ContractFactory: any = await ethers.getContractFactory(contract);

    console.log(`Deploying ${contract} ...`);

    // handle constructor args

    const constructorArguments: unknown[] = [];
    const entries = await readDeploymentsFile();
    switch (contract) {
      case "AccountRegistry":
        constructorArguments.push(entries[network.name]?.buildTeamMultisig);
        break;
      case "NodeRegistry":
        constructorArguments.push(entries[network.name]?.AccountRegistry);
        break;
      case "CollectionFactory":
        constructorArguments.push(
          entries[network.name]?.NodeRegistry,
          entries[network.name]?.Collection
        );
        break;
      case "SplitFactory":
        constructorArguments.push(
          entries[network.name]?.NodeRegistry,
          entries[network.name]?.SplitMain
        );
        break;
      case "WaterfallFactory":
        constructorArguments.push(
          entries[network.name]?.NodeRegistry,
          entries[network.name]?.WaterfallModuleFactory
        );
        break;
    }

    const deployed = await ContractFactory.deploy(...constructorArguments);
    await deployed.deployed();
    const address = deployed.address;

    console.log("\n\n---");
    console.log(`🚀 ${contract}: ${address}`);
    if (constructorArguments.length > 0) {
      console.log(`\nconstructor args: ${constructorArguments.join(" ")}`);
    }
    console.log("---\n\n");

    if (network.name !== "localhost" && network.name !== "hardhat") {
      console.log("updating deployments.json ...");
      const entries = await readDeploymentsFile();
      const entry = entries[network.name] ?? {};
      entries[network.name] = { ...entry, [contract]: address };
      await writeDeploymentsFile(entries);

      console.log("waiting 60 seconds before attempting to verify ...");
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

      console.log("verifying...");
      try {
        await run("verify:verify", {
          address: deployed.address,
          constructorArguments,
        });
      } catch (err) {
        console.warn("Verfication error:", err);
      }
    }

    return address;
  });

task("deploy:all", "Deploy the entire contract cluster").setAction(
  async (_, { run }) => {
    await run("deploy", { contract: "AccountRegistry" });
    await run("deploy", { contract: "NodeRegistry" });
    await run("deploy", { contract: "Collection" });
    await run("deploy", { contract: "CollectionFactory" });
    await run("deploy", { contract: "SplitFactory" });
    await run("deploy", { contract: "WaterfallFactory" });
  }
);
