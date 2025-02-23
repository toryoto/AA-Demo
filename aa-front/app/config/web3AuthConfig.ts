import { sepolia } from 'viem/chains'

export const web3AuthConfig = {
  chain: sepolia,
  walletConfig: {
    name: 'Web3Auth',
    logo: 'https://web3auth.io/images/BrandLogo.png',
    walletBackground: '#ffffff',
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
    uiConfig: {
      appName: 'Your App Name',
      mode: 'light',
      useLogoLoader: true,
      defaultLanguage: 'en',
      theme: {
        primary: '#000000'
      },
      loginMethodsOrder: ['google'],
      uxMode: 'redirect',
      modalZIndex: '2147483647'
    },
  }
}