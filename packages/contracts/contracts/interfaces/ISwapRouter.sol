// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.28;

/**
 * @title ISwapRouter (Uniswap SwapRouter02, minimal)
 * @notice The subset of the **unmodified** Uniswap `SwapRouter02` we call for
 *         residual settlement. Noxage never forks or modifies Uniswap — this is
 *         just the canonical external interface.
 * @dev Signature matches `IV3SwapRouter.exactInputSingle` from SwapRouter02.
 *      Unlike the older v3-periphery SwapRouter struct, SwapRouter02 omits the
 *      `deadline` field. The struct shape is part of the function selector.
 */
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another.
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}
