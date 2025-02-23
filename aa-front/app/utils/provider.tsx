'use client'
import '@rainbow-me/rainbowkit/styles.css'
import { connectorsForWallets, getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AAProvider } from '../contexts/AAContext'
import { rainbowWeb3AuthConnector } from '../config/rainbowWeb3AuthConnector'
import { web3AuthConfig } from '../config/web3AuthConfig'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

const { wallets } = getDefaultWallets({
  appName: 'ERC-4337 Demo',
  projectId,
})

const web3AuthWallet = rainbowWeb3AuthConnector(web3AuthConfig)

const connectors = connectorsForWallets([
  ...wallets,
  {
    groupName: 'Social Auth',
    wallets: [web3AuthWallet]
  }
], {
  appName: 'ERC-4337 Demo',
  projectId,
  appIcon: 'https://web3auth.io/images/BrandLogo.png'
})

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`),
  },
  connectors,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider modalSize="compact">
          <AAProvider>
            {children}
          </AAProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}