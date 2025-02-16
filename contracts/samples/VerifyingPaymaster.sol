// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "../core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract VerifyingPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    address public immutable verifyingSigner;

    constructor(IEntryPoint _entryPoint, address _verifyingSigner) BasePaymaster(_entryPoint) {
        verifyingSigner = _verifyingSigner;
    }

    // UserOpのデータをエンコードする
    function pack(
    UserOperation calldata userOp
  ) internal pure returns (bytes memory ret) {
    address sender = userOp.getSender();
    uint256 nonce = userOp.nonce;
    uint256 callGasLimit = userOp.callGasLimit;
    uint256 verificationGasLimit = userOp.verificationGasLimit;
    uint256 preVerificationGas = userOp.preVerificationGas;
    uint256 maxFeePerGas = userOp.maxFeePerGas;
    uint256 maxPriorityFeePerGas = userOp.maxPriorityFeePerGas;

    return
      abi.encode(
        sender,
        nonce,
        userOp.initCode,
        userOp.callData,
        callGasLimit,
        verificationGasLimit,
        preVerificationGas,
        maxFeePerGas,
        maxPriorityFeePerGas
      );
  }

//   function pack(UserOperation calldata userOp) internal pure returns (bytes memory ret) {
//         bytes calldata pnd = userOp.paymasterAndData;
//         assembly {
//             let ofs := userOp
//             let len := sub(sub(pnd.offset, ofs), 32)
//             ret := mload(0x40)
//             mstore(0x40, add(ret, add(len, 32)))
//             mstore(ret, len)
//             calldatacopy(add(ret, 32), ofs, len)
//         }
//     }

    // オフチェーンの署名用のハッシュを生成
    function getHash(UserOperation calldata userOp)
    public view returns (bytes32) {
        return keccak256(abi.encode(
            pack(userOp),
            block.chainid,
            address(this)
        ));
    }

    /**
     * paymasterAndData[:20] : address(this)
     * paymasterAndData[20:] : signature
     */
    function _validatePaymasterUserOp(UserOperation calldata userOp, bytes32 /*userOpHash*/, uint256 requiredPreFund)
    internal view override returns (bytes memory context, uint256 validationData) {
        (requiredPreFund);

        bytes calldata signature = userOp.paymasterAndData[20:];
        require(signature.length == 64 || signature.length == 65, "SimpleVerifyingPaymaster: invalid signature length");

        bytes32 hash = ECDSA.toEthSignedMessageHash(getHash(userOp));

        if (verifyingSigner != ECDSA.recover(hash, signature)) {
            return ("", 1); // SIG_VALIDATION_FAILED
        }

        return ("", 0);
    }
}