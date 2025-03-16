const hre = require("hardhat");
import { ethers } from 'hardhat'

async function main() {
  try {
    const paymasterAddress = "0x5FD7558baa2e88EdDaC01e7469b68Ba19116D2d3";
    
    const daiTokenAddress = "0xBf9Bc16E275394CCE4D5da802F877aA5b8A837C8";
    
    const exchangeRate = ethers.utils.parseUnits("2500", 18);
    
    const paymaster = await hre.ethers.getContractAt("MultiTokenPaymaster", paymasterAddress);
    
    const tx = await paymaster.addToken(daiTokenAddress, exchangeRate);
    await tx.wait();
    
    console.log("Successfully added DAI token to MultiTokenPaymaster");
    console.log("Transaction hash:", tx.hash);
    
    const isSupported = await paymaster.isTokenSupported(daiTokenAddress);
    console.log("DAI is supported:", isSupported);
    
    const tokenInfo = await paymaster.tokenInfo(daiTokenAddress);
    console.log("DAI Token Info:", {
      active: tokenInfo.active,
      exchangeRate: ethers.utils.formatUnits(tokenInfo.exchangeRate, 18),
      decimals: tokenInfo.decimals
    });
    
  } catch (error) {
    console.error("Failed to add DAI token:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});