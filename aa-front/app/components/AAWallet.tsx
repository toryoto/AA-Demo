'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const SIMPLE_ACCOUNT_FACTORY_ADDRESS = '0x9406Cc6185a346906296840746125a0E44976454'

const SIMPLE_ACCOUNT_FACTORY_ABI = [
  "function getAddress(address owner, uint256 salt) view returns (address)",
  "function createAccount(address owner, uint256 salt)"
]

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
        const provider = new ethers.providers.Web3Provider(walletClient.transport)
        const signer = provider.getSigner()
        console.log(provider)
        console.log(signer)

        // bytes32形式のsalt生成
        const salt = ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32)

        const factory = new ethers.Contract(
          SIMPLE_ACCOUNT_FACTORY_ADDRESS,
          SIMPLE_ACCOUNT_FACTORY_ABI,
          signer
        )

        const calculatedAddress = await factory.getAddress(address, salt)
        setAaAddress(calculatedAddress)

        const code = await provider.getCode(calculatedAddress)
        const deployed = code !== '0x'
        setIsDeployed(deployed)

        if (!deployed) {
          const tx = await factory.createAccount(address, 0, {
            gasLimit: 500000
          })
          
          const receipt = await tx.wait()
          console.log('Deployment receipt:', receipt)
          setIsDeployed(true)
        }
      } catch (error) {
        console.error('Detailed error:', {
          message: error.message,
          code: error.code,
          data: error.data
        })
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