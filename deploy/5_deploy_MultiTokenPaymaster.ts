const hre = require("hardhat");

async function main() {
  try {
    const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

    const MultiTokenPaymaster = await hre.ethers.getContractFactory("MultiTokenPaymaster");
    const multiTokenPaymaster = await MultiTokenPaymaster.deploy(entryPointAddress);
    await multiTokenPaymaster.deployed();
    console.log("MultiTokenPaymaster deployed to:", multiTokenPaymaster.address);
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});