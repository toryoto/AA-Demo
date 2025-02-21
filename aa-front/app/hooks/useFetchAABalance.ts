import { useEffect, useState } from "react";
import { formatEther, Hex } from "viem";
import { publicClient } from "../utils/client";

export const useFetchAABalance = (aaAddress: Hex) => {
  const [balance, setBalance] = useState<string>('');
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!aaAddress || aaAddress === '0x') {
        setBalance('');
        return;
      }
      setIsBalanceLoading(true);
      try {
        const fetchedBalance = await publicClient.getBalance({ address: aaAddress });
        setBalance(formatEther(fetchedBalance));
      } catch (error) {
        console.error('Error fetching balance:', error);
        setError(error as Error);
      } finally {
        setIsBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [aaAddress]);

  return { balance, isBalanceLoading, error };
};