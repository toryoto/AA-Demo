'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { 
  createPublicClient, 
  http, 
  concat, 
  encodeFunctionData, 
  getContract,
  Hash,
  toHex,
  Hex,
  createClient
} from 'viem'
import { sepolia } from 'viem/chains'
import { bundlerActions } from 'viem/account-abstraction'
import { accountFactoryAbi } from '../abi/accountFactory'
import { entryPointAbi } from '../abi/entryPoint'
import { verifyingPaymasterAbi } from '../abi/verifyingPaymaster'

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const FACTORY_ADDRESS = '0x101DA2ce5A5733BAbc1956a71C5d640c8E6a113d'

export interface UserOperation {
  sender: Hex;
  nonce: Hex;
  initCode: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymasterAndData: Hex;
  signature: Hex;
  chainId: number;
}


export default function AAWallet() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [aaAddress, setAaAddress] = useState('')
  const [isDeployed, setIsDeployed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)

  // Public Clientの作成
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)
  })

  // Bundler Clientの作成
  const bundlerClient = createClient({ 
    chain: sepolia,
    transport: http(`https://api.pimlico.io/v1/sepolia/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`)
  }).extend(bundlerActions)

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

        // アカウントアドレスの予測
        const salt = 0
        const predictedAddress = await factory.read.getAddress([address, BigInt(salt)]) as Hex

        setAaAddress(predictedAddress)
        
        // デプロイ状態の確認
        const code = await publicClient.getCode({ address: predictedAddress })
        setIsDeployed(Boolean(code?.length))

      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAA()
  }, [walletClient, address, publicClient])

  const deployAccount = async () => {
    console.log(111)
    if (!address || !walletClient || !aaAddress) return
    console.log(222)
    
    setDeploying(true)
    try {
      // initCodeの作成
      const initCode = concat([
        FACTORY_ADDRESS,
        encodeFunctionData({
          abi: accountFactoryAbi,
          functionName: 'createAccount',
          args: [address, 0]
        })
      ])

      // ガス料金の取得
      const [priorityFee] = await Promise.all([
        publicClient.getBlock({ blockTag: 'latest' }).then(block => block.baseFeePerGas!),
        publicClient.estimateFeesPerGas().then(fees => fees.maxPriorityFeePerGas)
      ])
      
      // UserOperationの作成
      const userOperation: UserOperation = {
        sender: toHex(aaAddress),
        nonce: toHex(0),
        chainId: sepolia.id,
        initCode,
        callData: '0x',
        callGasLimit: toHex(3_000_000),
        verificationGasLimit: toHex(3_000_000),
        preVerificationGas: toHex(3_000_000),
        maxFeePerGas: toHex(3_000_000),
        maxPriorityFeePerGas: toHex(priorityFee),
        paymasterAndData: '0x',
        signature: '0x'
      }

      // UserOperationハッシュの計算と署名
      const entryPoint = getContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        client: publicClient
      })

      const userOpHashForSign = await entryPoint.read.getUserOpHash([userOperation])

      const signature = await walletClient.signMessage({
        message: { raw: userOpHashForSign as Hash }
      })
      
      userOperation.signature = signature

      // UserOperationの送信
      const userOpHash = await bundlerClient.request({
        method: 'eth_sendUserOperation',
        params: [userOperation, ENTRY_POINT_ADDRESS]
      })

      console.log('UserOperation Hash:', userOpHash)

      // 受領の待機
      const receipt = await publicClient.waitForTransactionReceipt({ hash: userOpHash });

      console.log('Transaction hash:', receipt.transactionHash)
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
            {!isDeployed && !loading && (
              <button
                onClick={deployAccount}
                disabled={deploying}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
              >
                {deploying ? 'Deploying...' : 'Deploy via Bundler'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}