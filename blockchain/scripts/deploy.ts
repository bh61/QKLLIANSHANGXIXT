import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const messageBoard = await ethers.deployContract("MessageBoard");
  await messageBoard.waitForDeployment();

  console.log("MessageBoard deployed to:", await messageBoard.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});