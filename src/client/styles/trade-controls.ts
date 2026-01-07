import { css } from "lit";

export default css`
    .stock-select, .amount-input, .cost-display {
        background: #ffffff;
        border: 3px solid var(--ink-black) !important;
        color: var(--ink-black) !important;
        font-family: var(--ticker-font);
        font-weight: bold;
        box-shadow: inset 3px 3px 0 rgba(0,0,0,0.2) !important;
        text-align: center;
        text-align-last: center;
        box-sizing: border-box;
    }

    .btn-buy, .btn-sell, .qty-btn {
        border: 3px solid var(--ink-black) !important;
        font-family: var(--retro-font);
        text-transform: uppercase;
        font-weight: bold;
        color: white;
        cursor: pointer;
        transition: all 0.1s;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.4);
    }
`;