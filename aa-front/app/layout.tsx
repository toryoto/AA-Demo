import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AA Demo",
  description: "Create Simple Account and Build UserOperations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
