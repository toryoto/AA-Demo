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
} from 'viem'
import { sepolia } from 'viem/chains'
import { bundlerActions } from 'viem/account-abstraction'
import { accountFactoryAbi } from '../abi/accountFactory'
import { entryPointAbi } from '../abi/entryPoint'
import { verifyingPaymasterAbi } from '../abi/verifyingPaymaster'
import { UserOperation } from '../lib/userOperationType'
import { privateKeyToAccount } from 'viem/accounts'

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const FACTORY_ADDRESS = '0x101DA2ce5A5733BAbc1956a71C5d640c8E6a113d'
const PAYMASTER_ADDRESS = '0xf8B81A5197c1A50760DdebA82939c9091B1cAd48'


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
    transport: http(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`)
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

  const encodePaymasterAndData = ({
    paymaster: paymasterAddress,
    data,
  }: {
    paymaster: Hex;
    data: Hex;
  }) => {
    const encoded = `${paymasterAddress.replace('0x', '')}${data.replace('0x', '')}`;
    return `0x${encoded}` as Hex;
  };

  const getPaymasterAndData = async (userOp: UserOperation) => {
    try {
      const verifyingPaymaster = getContract({
        address: PAYMASTER_ADDRESS,
        abi: verifyingPaymasterAbi,
        client: publicClient
      })
  
      const userOpHash = await verifyingPaymaster.read.getHash([userOp])
      console.log("Hash from contract:", userOpHash);
  
      // const response = await fetch('/api/paymaster/sign', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   // body: JSON.stringify({ hash }), // ハッシュ検証をサーバー側で行う場合は、userOpも送る
      //   body: JSON.stringify({ hash, userOp }),
      // })
  
      // const { signature } = await response.json()
      // console.log("Signature from API:", signature);

      const paymasterAccount = privateKeyToAccount(process.env.NEXT_PUBLIC_PAYMASTER_PRIVATE_KEY as `0x${string}`)
      const signature = await paymasterAccount.signMessage({
        message: {
          raw: userOpHash as `0x${string}`,
        },
      });
      console.log("Generated signature:", signature);
  
      const paymasterAndData = encodePaymasterAndData({
        paymaster: PAYMASTER_ADDRESS,
        data: signature,
      });
  
      // const verifyingSigner = await verifyingPaymaster.read.verifyingSigner()

      console.log("paymaster data:", paymasterAndData)
  
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

      // const [priorityFee] = await Promise.all([
      //   publicClient.getBlock({ blockTag: 'latest' }).then(block => block.baseFeePerGas!),
      //   publicClient.estimateFeesPerGas().then(fees => fees.maxPriorityFeePerGas)
      // ])

      const nonce = await publicClient.readContract({
        address: ENTRY_POINT_ADDRESS,
        abi: entryPointAbi,
        functionName: 'getNonce',
        args: [aaAddress, BigInt(0)],
      }) as bigint;
      // console.log('nonce: ', nonce);
      
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

      userOperation.paymasterAndData = await getPaymasterAndData(userOperation)

      // UserOperationハッシュの計算と署名
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