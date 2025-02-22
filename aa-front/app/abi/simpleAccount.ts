export const SimpleAccountABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { type: 'address', name: 'dest' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'func' }
    ],
    outputs: [{ type: 'bytes', name: 'ret' }],
    stateMutability: 'payable'
  },
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "dest",
        type: "address[]",
        internalType: "address[]"
      },
      {
        name: "values",
        type: "uint256[]",
        internalType: "uint256[]"
      },
      {
        name: "func",
        type: "bytes[]",
        internalType: "bytes[]"
      }
    ],
    outputs: []
  }
]