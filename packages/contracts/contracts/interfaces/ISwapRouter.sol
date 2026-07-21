// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.28;

/**
 * @title ISwapRouter (Uniswap v3, minimal)
 * @notice The subset of the **unmodified** Uniswap v3 `SwapRouter` we call for
 *         residual settlement. Noxage never forks or modifies Uniswap — this is
 *         just the canonical external interface.
 * @dev Signature matches Uniswap's `ISwapRouter.exactInputSingle`
 *      (v3-periphery). On Sepolia we target the canonical SwapRouter deployment.
 */
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another.
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}
