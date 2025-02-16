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
  toHex,
  Hex,
  createClient,
  padHex,
} from 'viem'
import { sepolia } from 'viem/chains'
import { bundlerActions } from 'viem/account-abstraction'
import { accountFactoryAbi } from '../abi/accountFactory'
import { entryPointAbi } from '../abi/entryPoint'
import { verifyingPaymasterAbi } from '../abi/verifyingPaymaster'
import { UserOperation } from '../lib/userOperationType'

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const FACTORY_ADDRESS = '0x101DA2ce5A5733BAbc1956a71C5d640c8E6a113d'
const PAYMASTER_ADDRESS = '0xCDAA8197b37C2Ef2F47249612347bDa698dA991b'


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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletClient, address])

  const getPaymasterAndData = async (userOp: UserOperation) => {
    try {
      const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const validAfter = BigInt(Math.floor(Date.now() / 1000) - 60)
  
      const verifyingPaymaster = getContract({
        address: PAYMASTER_ADDRESS,
        abi: verifyingPaymasterAbi,
        client: publicClient
      })
  
      const hash = await verifyingPaymaster.read.getHash([userOp, validUntil, validAfter])
  
      const response = await fetch('/api/paymaster/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hash,
          validUntil: validUntil.toString(),
          validAfter: validAfter.toString()
        }),
      })
  
      if (!response.ok) {
        throw new Error('Failed to get paymaster signature')
      }
  
      const { signature } = await response.json()
  
      // Paymasterのアドレスを含めた形式で構築
      const paymasterAndData = concat([
        PAYMASTER_ADDRESS,
        padHex(toHex(validUntil), { size: 32 }),
        padHex(toHex(validAfter), { size: 32 }),
        signature
      ])

      console.log('Hash to be signed:', hash)

      return paymasterAndData
    } catch (error) {
      console.error('Error getting paymaster signature:', error)
      throw error
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

      console.log("initCode: ", initCode)

      // ガス料金の取得
      const [priorityFee] = await Promise.all([
        publicClient.getBlock({ blockTag: 'latest' }).then(block => block.baseFeePerGas!),
        publicClient.estimateFeesPerGas().then(fees => fees.maxPriorityFeePerGas)
      ])

      const nonce = await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        functionName: 'getNonce',
        args: [aaAddress, BigInt(0)],
      }) as bigint;
      console.log('nonce: ', nonce);
      
      // UserOperationの作成
      const userOperation: UserOperation = {
        sender: aaAddress as `0x${string}`,
        nonce: toHex(nonce),
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

      userOperation.paymasterAndData = await getPaymasterAndData(userOperation)

      // UserOperationハッシュの計算と署名
      const entryPoint = getContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        client: publicClient
      })


      const userOpHashForSign = await entryPoint.read.getUserOpHash([userOperation])
      console.log("userOpHashForSign:",userOpHashForSign)

      const signature = await walletClient.signMessage({
        message: { raw: userOpHashForSign as `0x${string}` }
      })
      
      userOperation.signature = signature

      // UserOperationの送信
      const userOpHash = await bundlerClient.request({
        method: 'eth_sendUserOperation',
        params: [userOperation, ENTRY_POINT_ADDRESS]
      })

      console.log('UserOperation Hash:', userOpHash)

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