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

const KNOWN_ABIS = [
  ...SimpleAccountABI,
  ...erc20Abi,
  ...dexRouterAbi,
  ...wrappedSepolia
];

function decodeSingleCallData(callData: Hex): DecodedSingleCallData {
  if (!callData || callData.length < 10) {
    return { functionName: 'Unknown', args: [] };
  }

  try {
    for (const abiItem of KNOWN_ABIS) {
      if (abiItem.type !== 'function') continue;
      
      try {
        const decoded = decodeFunctionData({
          abi: [abiItem],
          data: callData
        });
        
        if (decoded) {
          return {
            functionName: abiItem.name || 'Unknown',
            args: Array.isArray(decoded.args) ? decoded.args : []
          };
        }
      } catch {
        // Continue trying other ABIs
      }
    }
    
    return {
      functionName: 'Unknown',
      args: [],
      callData
    };
  } catch {
    return {
      functionName: 'Unknown',
      args: [],
      callData
    };
  }
}

function decodeCallData(callData: Hex): DecodedCallData {
  if (!callData || callData.length < 10) {
    return { functionName: 'Unknown', args: [], operations: [] };
  }

  try {
    // Try to decode with known ABIs
    for (const abiItem of KNOWN_ABIS) {
      if (abiItem.type !== 'function') continue;
      
      try {
        const decoded = decodeFunctionData({
          abi: [abiItem],
          data: callData
        });
        
        if (decoded) {
          // If this is a SimpleAccount execute function
          if (abiItem.name === 'execute' && decoded.args && decoded.args.length >= 3) {
            const dest = decoded.args[0] as string;
            const value = decoded.args[1] as bigint;
            const innerCallData = decoded.args[2] as Hex;
            
            // Try to decode the inner transaction
            let innerOperation: DecodedSingleCallData | null = null;
            
            if (innerCallData && innerCallData.length >= 10 && innerCallData !== '0x') {
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
                  args: innerOperation ? innerOperation.args : []
                }
              ]
            };
          }
          
          // executeBatch function with (address[] dest, uint256[] value, bytes[] func)
          if (abiItem.name === 'executeBatch' && decoded.args && decoded.args.length >= 3) {
            const destinations = decoded.args[0] as string[];
            const values = decoded.args[1] as bigint[];
            const datas = decoded.args[2] as Hex[];
            
            // Decode each inner transaction
            const operations = datas.map((data, index) => {
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
              args: decoded.args,
              operations
            };
          }
          
          // Return decoded data for any other function
          return {
            functionName: abiItem.name || 'Unknown',
            args: Array.isArray(decoded.args) ? decoded.args : [],
            operations: []
          };
        }
      } catch (e) {
        // Continue trying other ABIs
      }
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

  const formatArgsForDisplay = (args: any[]): string => {
    try {
      return JSON.stringify(args, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2);
    } catch {
      return '[Error displaying arguments]';
    }
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
                            {op.value.toString()} wei
                          </span>
                        )}
                      </div>
                      {op.contractAddress && (
                        <div className="mb-1">
                          <span className="text-xs text-slate-500">Contract: </span>
                          <span className="text-xs font-mono break-all">{op.contractAddress}</span>
                        </div>
                      )}
                      <div className="mt-1">
                        <details className="text-xs">
                          <summary className="cursor-pointer hover:text-blue-600">View arguments</summary>
                          <div className="mt-1 bg-slate-100 p-2 rounded text-xs font-mono overflow-x-auto">
                            <pre className="whitespace-pre-wrap break-all">{formatArgsForDisplay(op.args)}</pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Only show raw arguments if there are no operations */}
            {(!decodedData.operations || decodedData.operations.length === 0) && (
              <>
                {/* Contract address if available */}
                {decodedData.contractAddress && (
                  <div className="mb-3">
                    <span className="text-sm font-medium">Contract: </span>
                    <span className="text-sm font-mono break-all">{decodedData.contractAddress}</span>
                  </div>
                )}
                
                {/* Arguments */}
                <div className="mb-2">
                  <span className="text-sm font-medium">Arguments:</span>
                </div>
                <div className="bg-slate-100 p-2 rounded text-xs font-mono overflow-x-auto">
                  <pre className="whitespace-pre-wrap break-all">{formatArgsForDisplay(decodedData.args)}</pre>
                </div>
              </>
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