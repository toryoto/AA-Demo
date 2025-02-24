import { Metadata } from "next";
import "./globals.css";
import { Providers } from './utils/provider'
import { Toaster } from 'sonner'


export const metadata: Metadata = {
  title: "ERC4337 Demo",
  description: "Create Smart Account and Make UserOperations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}