'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  concat, 
  encodeFunctionData, 
  getContract,
  toHex,
  Hex,
  formatEther,
} from 'viem'
import { accountFactoryAbi } from '../abi/accountFactory'
import { entryPointAbi } from '../abi/entryPoint'
import { UserOperation } from '../lib/userOperationType'
import { RefreshCcw } from 'lucide-react'
import { ENTRY_POINT_ADDRESS, FACTORY_ADDRESS } from '../constants/addresses'
import { publicClient, bundlerClient } from '../utils/client'
import { usePaymasterData } from '../hooks/usePaymasterData'

export default function AAWallet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [aaAddress, setAaAddress] = useState<Hex>('0x')
  const [isDeployed, setIsDeployed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [balance, setBalance] = useState<string>('')
  const { getPaymasterAndData } = usePaymasterData();


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
        
        // デプロイ状態の確認
        const code = await publicClient.getCode({ address: predictedAddress })
        setIsDeployed(Boolean(code?.length))

        if (Boolean(code?.length)) {
          const balance = await publicClient.getBalance({ address: predictedAddress })
          setBalance(formatEther(balance))
        }

      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAA()
  }, [walletClient, address])

  const updateBalance = async () => {
    if (!aaAddress || !isDeployed) return
    try {
      const balance = await publicClient.getBalance({ address: aaAddress })
      setBalance(formatEther(balance))
    } catch (error) {
      console.error('Error fetching balance:', error)
    }
  }

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
      const nonce = await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        functionName: 'getNonce',
        args: [aaAddress, BigInt(0)],
      }) as bigint;
      
      // UserOperationの作成
      const userOperation: UserOperation = {
        sender: aaAddress as `0x${string}`,
        nonce: toHex(nonce),
        initCode,
        callData: '0x',
        callGasLimit: toHex(3_000_000),
        verificationGasLimit: toHex(3_000_000),
        preVerificationGas: toHex(3_000_000),
        maxFeePerGas: toHex(2_000_000_000),
        maxPriorityFeePerGas: toHex(2_000_000_000),
        paymasterAndData: '0x',
        signature: '0x',
      }


      const paymasterAndData = await getPaymasterAndData(userOperation)
      userOperation.paymasterAndData = paymasterAndData
      console.log(userOperation.paymasterAndData)

      const entryPoint = getContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        client: publicClient
      })
      const userOpHashForSign = await entryPoint.read.getUserOpHash([userOperation])

      const signature = await walletClient.signMessage({
        message: { raw: userOpHashForSign as `0x${string}` }
      })
      userOperation.signature = signature

      const userOpHash = await bundlerClient.request({
        method: 'eth_sendUserOperation',
        params: [userOperation, ENTRY_POINT_ADDRESS]
      })

      console.log('UserOperation Hash:', userOpHash)

      const receipt = await publicClient.waitForTransactionReceipt({ hash: userOpHash });

      console.log('Transaction hash:', receipt.transactionHash)
      setIsDeployed(true)

      await updateBalance()

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
                    <span className="font-mono">{balance ? `${balance} ETH` : 'Loading...'}</span>
                  </p>
                  <button
                    onClick={updateBalance}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors duration-200"
                    title="Refresh balance"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}