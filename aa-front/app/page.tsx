'use client'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const AAWallet = dynamic(
  () => import('../app/components/AAWallet'),
  { ssr: false }
)

export default function Home() {
  return (
    <div className="container">
      <h1>AA Wallet Demo</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <AAWallet />
      </Suspense>
    </div>
  )
}