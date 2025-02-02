'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { WalletClient } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import { BundlerJsonRpcProvider, Presets, Client, UserOperationBuilder } from 'userop'
import { JsonRpcProvider } from '@ethersproject/providers'
import { providers } from 'ethers'
import { EntryPoint__factory, SimpleAccountFactory__factory } from 'userop/dist/typechain'

const entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const factory = '0x9406Cc6185a346906296840746125a0E44976454'
const bundlerUrl = 'https://bundler.service.nerochain.io'
const rpcUrl = 'https://rpc-testnet.nerochain.io';
const provider = new BundlerJsonRpcProvider(rpcUrl)

export default function AAWallet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [aaAddress, setAaAddress] = useState('')
  const [isDeployed, setIsDeployed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const initializeAA = async () => {
      if (!walletClient || !address) return
      
      setLoading(true)
      try {
        const { account, chain, transport } = walletClient
        console.log(walletClient)
        const network = {
          chainId: chain.id,
          name: chain.name,
          ensAddress: chain.contracts?.ensRegistry?.address,
        }
        const provider = new providers.Web3Provider(transport, network)
        const signer = provider.getSigner(account.address)
        console.log(11)

        const factoryInterface = SimpleAccountFactory__factory.connect(
          factory,
          provider,
        )
        const entryPointInterface = EntryPoint__factory.connect(
          entryPoint,
          provider,
        )
        console.log(factoryInterface)

        const initCode = await ethers.utils.hexConcat([
          factory,
          factoryInterface.interface.encodeFunctionData('createAccount', [
            address,
            0,
          ]),
        ])
        console.log(initCode)
        const accountAddress = await entryPointInterface.callStatic.getSenderAddress(initCode);
        console.log("Account Address:", accountAddress);
   
        // const client = await Client.init(rpcUrl, { entryPoint: entryPoint });
        // const userOpBuilder = new UserOperationBuilder();
        // userOpBuilder.setSender(accountAddress);
        // userOpBuilder.setInitCode(initCode);
        // const res = await client.sendUserOperation(userOpBuilder, {
        //   onBuild: (op) => console.log("Signed UserOperation:", op),
        // });
   
        // console.log("UserOpHash:", res.userOpHash);
        // const ev = await res.wait();
        // console.log("Transaction Hash:", ev?.transactionHash);

      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAA()
  }, [walletClient, address])

  return (
    <div>
      <ConnectButton />

      {address && (
        <div className="content">
          <div className="section">
            <h2>Account Info</h2>
            <p>EOA Address: {address}</p>
            <p>AA Address: {loading ? 'Loading...' : aaAddress}</p>
            <p>Status: {loading ? 'Checking...' : isDeployed ? 'Deployed' : 'Not Deployed'}</p>
          </div>
        </div>
      )}
    </div>
  )
}