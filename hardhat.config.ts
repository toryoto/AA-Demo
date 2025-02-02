import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import { HardhatUserConfig, task } from 'hardhat/config'
import 'hardhat-deploy'
import 'dotenv/config'
import '@nomicfoundation/hardhat-verify'

import 'solidity-coverage'

task('deploy', 'Deploy contracts')
  .addFlag('simpleAccountFactory', 'deploy sample factory (by default, enabled only on localhost)')

function getNetwork1 (url: string): { url: string, accounts: string[] } {
  const secretKey = process.env.SECRET_KEY!
  return {
    url,
    accounts: [secretKey]
  }
}

function getNetwork (name: string): { url: string, accounts: string[] } {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`)
}

const optimizedComilerSettings = {
  version: '0.8.23',
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true
  }
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{
      version: '0.8.23',
      settings: {
        optimizer: { enabled: true, runs: 1000000 }
      }
    }],
    overrides: {
      'contracts/core/EntryPoint.sol': optimizedComilerSettings,
      'contracts/samples/SimpleAccount.sol': optimizedComilerSettings
    }
  },
  networks: {
    sepolia: getNetwork('sepolia')
  },
  mocha: {
    timeout: 10000
  },
  // @ts-ignore
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }

}

// coverage chokes on the "compilers" settings
if (process.env.COVERAGE != null) {
  // @ts-ignore
  config.solidity = config.solidity.compilers[0]
}

export default config
