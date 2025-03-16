import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { Hex, decodeFunctionData } from 'viem';
import { SimpleAccountABI } from '../abi/simpleAccount';
import { erc20Abi } from '../abi/erc20';
import { dexRouterAbi } from '../abi/dexRouter';
import { wrappedSepolia } from '../abi/wrappedSepolia';

interface UserOpConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  callData: Hex | null;
}

interface DecodedSingleCallData {
  functionName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  callData?: Hex;
}

interface DecodedOperation {
  functionName: string;
  contractAddress?: string;
  value?: bigint;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
}

interface DecodedCallData {
  functionName: string;
  contractAddress?: string;
  value?: bigint;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  callData?: Hex;
  operations: DecodedOperation[];
}

const ABIS = [
  ...SimpleAccountABI,
  ...erc20Abi,
  ...dexRouterAbi,
  ...wrappedSepolia
];

function decodeSingleCallData(callData: Hex): DecodedSingleCallData {
  if (!callData || callData.length < 10) {
    return { functionName: 'Unknown', args: [] };
  }

  for (const abi of ABIS) {
    try {
      // calldataとabiを引数にデコードすることで元の情報を取得する
      const decoded = decodeFunctionData({
        abi: [abi],
        data: callData
      });
      
      if (decoded) {
        return {
          functionName: abi.name || 'Unknown',
          args: Array.isArray(decoded.args) ? decoded.args : []
        };
      }
    } catch {}
  }
  
  return {
    functionName: 'Unknown',
    args: [],
    callData
  };
}

function decodeCallData(callData: Hex): DecodedCallData {
  if (!callData || callData.length < 10) {
    return { functionName: 'Unknown', args: [], operations: [] };
  }

  try {
    // Try to decode with known ABIs
    for (const abi of ABIS) {
      if (abi.type !== 'function') continue;
      
      try {
        const decoded = decodeFunctionData({
          abi: [abi],
          data: callData
        });
        
        if (decoded) {
          if (abi.name === 'execute' && decoded.args && decoded.args.length >= 3) {
            const dest = decoded.args[0] as string;
            const value = decoded.args[1] as bigint;
            const innerCallData = decoded.args[2] as Hex;
            
            if (innerCallData === '0x') {
              return {
                functionName: 'execute',
                contractAddress: dest,
                value,
                args: [dest, value, innerCallData],
                operations: [
                  {
                    functionName: 'ETH Transfer',
                    contractAddress: dest,
                    value: value,
                    args: []
                  }
                ]
              };
            }
            
            let innerOperation: DecodedSingleCallData | null = null;
            
            if (innerCallData && innerCallData.length >= 10) {
              innerOperation = decodeSingleCallData(innerCallData);
            }
            
            return {
              functionName: 'execute',
              contractAddress: dest,
              value,
              args: [dest, value, innerCallData],
              operations: [
                {
                  functionName: innerOperation ? innerOperation.functionName : 'Unknown',
                  contractAddress: dest,
                  value: value,
                  args: innerOperation ? innerOperation.args : []
                }
              ]
            };
          }
          
          if (abi.name === 'executeBatch' && decoded.args && decoded.args.length >= 3) {
            const destinations = decoded.args[0] as string[];
            const values = decoded.args[1] as bigint[];
            const datas = decoded.args[2] as Hex[];
            
            // Decode each inner transaction
            const operations = datas.map((data, index) => {
              if (data === '0x') {
                return {
                  functionName: 'ETH Transfer',
                  contractAddress: destinations[index],
                  value: values[index],
                  args: []
                };
              }
              
              const decodedInner = decodeSingleCallData(data);
              return {
                functionName: decodedInner.functionName,
                contractAddress: destinations[index],
                value: values[index],
                args: decodedInner.args
              };
            });
            
            return {
              functionName: 'executeBatch',
              args: [...(decoded.args || [])],
              operations
            };
          }
        }
      } catch {}
    }
    
    // If decoding failed, return the raw calldata
    return {
      functionName: 'Unknown',
      args: [],
      callData,
      operations: []
    };
  } catch (error) {
    console.error('Error decoding calldata:', error);
    return {
      functionName: 'Unknown',
      args: [],
      callData,
      operations: []
    };
  }
}

export const UserOpConfirmationModal: React.FC<UserOpConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  callData,
}) => {
  // useMemoを使用してcallDataが変わった時のみdecodeDataを再実行する
  const decodedData = useMemo(() => {
    if (!callData) return null;
    return decodeCallData(callData);
  }, [callData]);
  console.log('calldata', callData)

  if (!callData || !decodedData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatArgsForDisplay = (args: any[]): string => {
    try {
      return JSON.stringify(args, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2);
    } catch {
      return '[Error displaying arguments]';
    }
  };

  // formatEth: ETH値をより読みやすい形式に変換する関数
  const formatEth = (value: bigint | undefined): string => {
    if (!value) return '0 ETH';
    
    // weiからETHに変換（1 ETH = 10^18 wei）
    const ethValue = Number(value) / 1e18;
    
    // 適切な小数点以下の桁数でフォーマット
    if (ethValue < 0.000001) {
      return `${value.toString()} wei`;
    }
    
    return `${ethValue.toFixed(6)} ETH`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Transaction</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            {/* Main function name */}
            <div className="mb-3">
              <span className="text-sm font-medium">Transaction Type: </span>
              <span className="text-sm font-mono">{decodedData.functionName}</span>
            </div>
            
            {/* If we have inner operations (execute or executeBatch) */}
            {decodedData.operations && decodedData.operations.length > 0 && (
              <div className="mb-3">
                <span className="text-sm font-medium">Operations:</span>
                <div className="mt-2 space-y-3">
                  {decodedData.operations.map((op, index) => (
                    <div key={index} className="bg-white p-2 rounded border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{index + 1}. {op.functionName}</span>
                        {op.value && op.value > BigInt(0) && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            {formatEth(op.value)}
                          </span>
                        )}
                      </div>
                      {op.contractAddress && (
                        <div className="mb-1">
                          <span className="text-xs text-slate-500">To: </span>
                          <span className="text-xs font-mono break-all">{op.contractAddress}</span>
                        </div>
                      )}
                      {op.args.length > 0 && (
                        <div className="mt-1">
                          <details className="text-xs">
                            <summary className="cursor-pointer hover:text-blue-600">View arguments</summary>
                            <div className="mt-1 bg-slate-100 p-2 rounded text-xs font-mono overflow-x-auto">
                              <pre className="whitespace-pre-wrap break-all">{formatArgsForDisplay(op.args)}</pre>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};