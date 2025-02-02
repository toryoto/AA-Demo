import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deploySimpleAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  const forceDeployFactory = process.argv.join(' ').match(/simple-account-factory/) != null

  if (!forceDeployFactory && network.chainId !== 31337 && network.chainId !== 1337 && network.chainId !== 11155111) {
    return
  }

  await hre.deployments.deploy(
    'SimpleAccountFactory', {
      from,
      args: ['0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'],
      gasLimit: 6e6,
      log: true,
      deterministicDeployment: true
    })

  await hre.deployments.deploy('TestCounter', {
    from,
    deterministicDeployment: true,
    log: true
  })
}

export default deploySimpleAccountFactory

deploySimpleAccountFactory.tags = ['SimpleAccountFactory']
