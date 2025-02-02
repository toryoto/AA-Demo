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
const factory = '0x101DA2ce5A5733BAbc1956a71C5d640c8E6a113d'
// const bundlerUrl = 'https://bundler.service.nerochain.io'
const bundlerUrl = `https://api.pimlico.io/v1/sepolia/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`
const rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
const provider = new BundlerJsonRpcProvider(rpcUrl)

export default function AAWallet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [aaAddress, setAaAddress] = useState('')
  const [isDeployed, setIsDeployed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)

  useEffect(() => {
    const initializeAA = async () => {
      if (!walletClient || !address) return
      
      setLoading(true)
      try {
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

        const salt = 0
        const predictedAddress = await factoryInterface.getAddress(address, salt)
        console.log("Predicted Account Address:", predictedAddress)
        setAaAddress(predictedAddress)

        // const code = await provider.getCode(predictedAddress)
        // setIsDeployed(code !== '0x')

        try {
          await entryPointInterface.callStatic.getSenderAddress(initCode)
        } catch (error: any) {
          if (error?.errorArgs?.[0]) {
            const accountAddress = error.errorArgs[0]
            console.log("Account Address:", accountAddress)
            setAaAddress(accountAddress)
            
            // デプロイ状態の確認
            const code = await provider.getCode(accountAddress)
            setIsDeployed(code !== '0x')
          }
        }

      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAA()
  }, [walletClient, address])

  return (
    <div className="p-4">
      <ConnectButton />
  
      {address && (
        <div className="mt-4 space-y-4">
          <h2 className="text-xl font-bold">Account Info</h2>
          <div className="space-y-2">
            <p>
              <span className="font-semibold">EOA Address:</span> {address}
            </p>
            <p>
              <span className="font-semibold">Smart Account Address:</span>{' '}
              {loading ? 'Loading...' : aaAddress || 'Not created'}
            </p>
            <p>
              <span className="font-semibold">Status:</span>{' '}
              {loading ? (
                'Checking...'
              ) : isDeployed ? (
                <span className="text-green-600">Deployed</span>
              ) : (
                <span className="text-yellow-600">Not Deployed</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}