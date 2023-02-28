import deployments from "../tasks/deployments.json";
import { promises } from "fs";
import { join } from "path";

async function main() {
  const goerli = await readSubgraphConfig("goerli");
  await writeSubgraphConfig("goerli", { ...goerli, ...deployments.goerli });

  const mainnet = await readSubgraphConfig("mainnet");
  await writeSubgraphConfig("mainnet", { ...mainnet, ...deployments.eth });
}

async function readSubgraphConfig(network: "goerli" | "mainnet") {
  const data = JSON.parse(
    `${await promises.readFile(
      join(__dirname, `../../metalabel-subgraph/config/${network}.json`)
    )}`
  );
  return data;
}

async function writeSubgraphConfig(network: "goerli" | "mainnet", config: any) {
  await promises.writeFile(
    join(__dirname, `../../metalabel-subgraph/config/${network}.json`),
    JSON.stringify(config, null, 2)
  );
  console.log(`Updated ${network} subgraph config`);
}

main();
