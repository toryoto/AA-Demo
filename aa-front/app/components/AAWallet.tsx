'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  concat, 
  encodeFunctionData, 
  getContract,
  Hex,
} from 'viem'
import { accountFactoryAbi } from '../abi/accountFactory'
import { FACTORY_ADDRESS } from '../constants/addresses'
import { publicClient } from '../utils/client'
import { usePaymasterData } from '../hooks/usePaymasterData'
import useUserOperation from '../hooks/useUserOperation'
import { useUserOperationManager } from '../hooks/useExecuteUserOperation'
import { useFetchAABalance } from '../hooks/useFetchAABalance'

export default function AAWallet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [aaAddress, setAaAddress] = useState<Hex>('0x')
  const [isDeployed, setIsDeployed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const { getPaymasterAndData } = usePaymasterData();
  const { createUserOperation } = useUserOperation();
  const { signAndSendUserOperation } = useUserOperationManager();
  const { balance, isBalanceLoading } = useFetchAABalance(aaAddress);


  useEffect(() => {
    const initializeAA = async () => {
      if (!walletClient || !address) return
      
      setLoading(true)
      try {
        const factory = getContract({
          address: FACTORY_ADDRESS,
          abi: accountFactoryAbi,
          client: publicClient
        })

        const salt = 0
        const predictedAddress = await factory.read.getAddress([address, BigInt(salt)]) as Hex

        setAaAddress(predictedAddress)
        
        const code = await publicClient.getCode({ address: predictedAddress })
        setIsDeployed(Boolean(code?.length))
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAA()
  }, [walletClient, address])

  const deployAccount = async () => {
    if (!address || !walletClient || !aaAddress) return
    setDeploying(true)
    try {
      const initCode = concat([
        FACTORY_ADDRESS,
        encodeFunctionData({
          abi: accountFactoryAbi,
          functionName: 'createAccount',
          args: [address, 0]
        })
      ])
      const userOperation = await createUserOperation(aaAddress, initCode)

      const paymasterAndData = await getPaymasterAndData(userOperation)
      userOperation.paymasterAndData = paymasterAndData
      console.log(userOperation.paymasterAndData)

      const userOpHash = await signAndSendUserOperation(userOperation)
      console.log('UserOperation Hash:', userOpHash)

      // const receipt = await publicClient.waitForTransactionReceipt({ hash: userOpHash });
      // console.log('Transaction hash:', receipt.transactionHash)
      setIsDeployed(true)
    } catch (error) {
      console.error('Deploy error:', error)
    } finally {
      setDeploying(false)
    }
  }
  
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
            <div className="flex items-center gap-4">
              <button
                onClick={deployAccount}
                disabled={deploying || isDeployed || loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2
                  ${isDeployed 
                    ? 'bg-green-100 text-green-800 cursor-not-allowed'
                    : deploying
                      ? 'bg-blue-100 text-blue-800 cursor-wait'
                      : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                  }`}
              >
                {isDeployed ? (
                  <>
                    <span className="text-lg">✓</span>
                    <span>Deployed</span>
                  </>
                ) : deploying ? (
                  <span>Deploying...</span>
                ) : (
                  <span>Deploy via Bundler</span>
                )}
              </button>
  
              {isDeployed && (
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg">
                  <p className="text-gray-700">
                    <span className="font-medium">Balance:</span>{' '}
                    {isBalanceLoading ? 'Loading...' : balance ? `${balance} ETH` : 'N/A'}
                  </p>
                </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}