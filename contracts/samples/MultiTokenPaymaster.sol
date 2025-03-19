// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../core/BasePaymaster.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * 複数のERC20トークンでガス代を支払うためのマルチトークンPaymaster
 */
contract MultiTokenPaymaster is Ownable, BasePaymaster {
    struct TokenInfo {
        bool active;
        uint256 exchangeRate; // 交換レート（1ETH = exchangeRate トークン）
        uint8 decimals;
    }
    
    mapping(address => TokenInfo) public tokenInfo;
    
    address[] public supportedTokens;
    
    // postOpの実行に必要な追加ガス
    uint256 public constant COST_OF_POST = 35000;

    event TokenConfigured(address token, uint256 exchangeRate);
    event TokenRemoved(address token);
    event TokenPayment(address token, address account, uint256 tokenAmount, uint256 ethAmount);

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) Ownable() {}

    /**
     * 新しいトークンの追加または既存トークンの更新
     * @param _token トークンのアドレス
     * @param _exchangeRate 交換レート（1ETH = exchangeRate トークン）
     */
    function addToken(address _token, uint256 _exchangeRate) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_exchangeRate > 0, "Exchange rate must be positive");
        
        // トークンが新規の場合、リストに追加
        if (!tokenInfo[_token].active) {
            supportedTokens.push(_token);
            // トークンの小数点位置を取得
            uint8 decimals = IERC20Metadata(_token).decimals();
            tokenInfo[_token] = TokenInfo(true, _exchangeRate, decimals);
        } else {
            // 既存トークンの場合は交換レートのみ更新
            tokenInfo[_token].exchangeRate = _exchangeRate;
        }
        
        emit TokenConfigured(_token, _exchangeRate);
    }


    function removeToken(address _token) external onlyOwner {
        require(tokenInfo[_token].active, "Token not active");
        tokenInfo[_token].active = false;
        emit TokenRemoved(_token);
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function isTokenSupported(address _token) public view returns (bool) {
        return tokenInfo[_token].active;
    }

    /**
     * ETHをトークンに変換する計算（トークンごとの固定レート）
     */
    function ethToToken(address _token, uint256 ethAmount) public view returns (uint256) {
        TokenInfo memory info = tokenInfo[_token];
        require(info.active, "Token not supported");
        
        // 交換レートとトークンの小数点を考慮した計算
        return (ethAmount * info.exchangeRate) / 1e18;
    }

    /**
     * UserOperationの検証
     * paymasterAndData構造:
     * paymasterAndData[:20] : address(this)
     * paymasterAndData[20:40] : トークンアドレス
     */
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // paymasterAndDataからトークンアドレスを取得
        require(userOp.paymasterAndData.length >= 40, "paymasterAndData too short");
        address tokenAddress = address(bytes20(userOp.paymasterAndData[20:40]));
        
        require(isTokenSupported(tokenAddress), "Token not supported");
        
        // ガス代の計算のために、COST_OF_POSTを追加
        uint256 totalGasCost = maxCost + (COST_OF_POST * userOp.maxFeePerGas);
        
        uint256 tokenAmount = ethToToken(tokenAddress, totalGasCost);
        
        // UserOp実行者からトークンを取得
        address sender = userOp.sender;
        IERC20(tokenAddress).transferFrom(sender, address(this), tokenAmount);
        
        emit TokenPayment(tokenAddress, sender, tokenAmount, totalGasCost);
        
        // コンテキストとしてトークンアドレス、ユーザーアドレス、トークン量、ETH量を返す
        return (abi.encode(tokenAddress, sender, tokenAmount, totalGasCost), 0);
    }

    function _postOp(
        PostOpMode /* mode */,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        // コンテキストからデータをデコード
        (address tokenAddress, address sender, /* uint256 preChargeTokenAmount */, uint256 preChargeEthAmount) = 
            abi.decode(context, (address, address, uint256, uint256));
        
        // 実際のコストにCOST_OF_POSTを加える（postOp自体の実行コスト）
        uint256 totalActualCost = actualGasCost + (COST_OF_POST * tx.gasprice);
        
        // 払い戻し計算（先に引き落とした額から実際の使用量を差し引く）
        if (preChargeEthAmount > totalActualCost) {
            // 差額を計算
            uint256 ethRefund = preChargeEthAmount - totalActualCost;
            uint256 tokenRefund = ethToToken(tokenAddress, ethRefund);
            
            // 余分なトークンを返却（失敗しても続行）
            // solhint-disable-next-line no-empty-blocks
            try IERC20(tokenAddress).transfer(sender, tokenRefund) {} catch {}
        }
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}