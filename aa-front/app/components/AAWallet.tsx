'use client'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function AAWallet() {
  const { address } = useAccount()
  const { data: signer } = useWalletClient()

  return (
    <div>
      <ConnectButton />

      {address && (
        <div className="content">
          <div className="section">
            <h2>Account Info</h2>
            <p>EOA Address: {address}</p>
            {/* <p>AA Address: {aaAddress || 'Not initialized'}</p>
            <p>Status: {isDeployed ? 'Deployed' : 'Not Deployed'}</p> */}
          </div>
        </div>
      )}
    </div>
  )
}