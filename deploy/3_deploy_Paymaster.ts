import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployVerifyingPaymaster: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const deployer = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  const forceDeployPaymaster = process.argv.join(' ').match(/verifying-paymaster/) != null

  if (!forceDeployPaymaster && network.chainId !== 11155111) {
    return
  }

  const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

  await hre.deployments.deploy(
    'VerifyingPaymaster', {
      from: deployer,
      args: [ENTRY_POINT, deployer], // DeployerをPaymasterのSignerとして指定
      gasLimit: 6e6,
      log: true,
      deterministicDeployment: true
    }
  )
}

export default deployVerifyingPaymaster

deployVerifyingPaymaster.tags = ['VerifyingPaymaster']
