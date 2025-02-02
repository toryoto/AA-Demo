// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "./SimpleAccount.sol";

// UserOpにinitCodeが含まれていて、ファクトリーコントラクトのアドレスと、createAccountメソッドの役割を保持する
// createAccountメソッドは、アカウントが存在しなければデプロイし、存在すればそのアカウントアドレス（ウォレットアドレス）を返す
// この仕組みにより、entryPoint.getSenderAddress()がアカウント作成前後のどちらのタイミングでも正しいアドレスを取得できるようになる
contract SimpleAccountFactory {
    SimpleAccount public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new SimpleAccount(_entryPoint);
    }

    // initCodeがUserOpに含まれている場合のみ呼び出される
    function createAccount(address owner,uint256 salt) public returns (SimpleAccount ret) {
        address addr = getAddress(owner, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            return SimpleAccount(payable(addr));
        }
        // プロキシコントラクトをデプロイして、その実装コントラクトとしてaccountImplementationを指定
        // プロキシコントラクトはdelegateCallで実装コントラクトのメソッドを実行する
        ret = SimpleAccount(payable(new ERC1967Proxy{salt : bytes32(salt)}(
                address(accountImplementation),
                abi.encodeCall(SimpleAccount.initialize, (owner))
            )));
    }

    // ownerとsaltを使用して、Create2でアカウントのアドレスを事前に取得する
    function getAddress(address owner,uint256 salt) public view returns (address) {
        return Create2.computeAddress(bytes32(salt), keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    address(accountImplementation),
                    abi.encodeCall(SimpleAccount.initialize, (owner))
                )
            )));
    }
}
