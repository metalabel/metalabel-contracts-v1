import { promises } from "fs";
import { join } from "path";

const { readFile, writeFile } = promises;
const filepath = join(__dirname, "./deployments.json");

type DeploymentsFile = Record<string, Record<string, string | undefined> | undefined>;

export const writeDeploymentsFile = async (contents: unknown) => {
  await writeFile(filepath, JSON.stringify(contents, null, 2));
};

export const readDeploymentsFile = async (): Promise<DeploymentsFile> => {
  const file = await readFile(filepath);
  const entries = JSON.parse(file.toString());
  return entries;
};
