// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter} from "../interfaces/ISwapRouter.sol";

/**
 * @title MockSwapRouter
 * @notice A test double for the Uniswap v3 SwapRouter — for LOCAL tests only.
 *
 * @dev This stands in for the external DEX so netting/settlement can be tested
 *      on the in-process hardhat network (where Uniswap is not deployed). It is
 *      NOT used on Sepolia — there the real, unmodified Uniswap v3 router is
 *      called. It does not fake any privacy; it only simulates a swap venue at a
 *      fixed, configurable price so the residual leg has deterministic output.
 *
 *      Price is expressed as `priceNum/priceDen` = tokenOut units per tokenIn
 *      unit. Must be pre-funded with output liquidity.
 */
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    // priceOut[tokenIn][tokenOut] = (num, den): amountOut = amountIn * num / den
    mapping(address => mapping(address => uint256)) public priceNum;
    mapping(address => mapping(address => uint256)) public priceDen;

    /// @notice Set the swap price for a directed pair (test setup only).
    function setPrice(address tokenIn, address tokenOut, uint256 num, uint256 den) external {
        require(den != 0, "den=0");
        priceNum[tokenIn][tokenOut] = num;
        priceDen[tokenIn][tokenOut] = den;
    }

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable override returns (uint256 amountOut) {
        uint256 num = priceNum[params.tokenIn][params.tokenOut];
        uint256 den = priceDen[params.tokenIn][params.tokenOut];
        require(num != 0 && den != 0, "no price");

        amountOut = (params.amountIn * num) / den;
        require(amountOut >= params.amountOutMinimum, "slippage");

        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);
    }
}
