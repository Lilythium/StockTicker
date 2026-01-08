import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import { DEFAULT_SETTINGS, GameSettings } from "../../common/index.js";
import { format_money } from "../params.js";

@customElement("host-sidebar")
export default class HostSidebar extends LitElement {
    @state()
    private max_rounds: number = DEFAULT_SETTINGS.max_rounds;

    @state()
    private trading_duration: number = DEFAULT_SETTINGS.trading_duration;

    @state()
    private dice_duration: number = DEFAULT_SETTINGS.dice_duration;

    @state()
    private starting_cash: number = DEFAULT_SETTINGS.starting_cash;

    get settings(): GameSettings {
        return {
            max_rounds: this.max_rounds,
            trading_duration: this.trading_duration,
            dice_duration: this.dice_duration,
            starting_cash: this.starting_cash
        };
    }

    static styles = css`
        .host-sidebar {
            width: 280px;
            flex-shrink: 0;
            padding: 20px;
            background: var(--paper-white);
            border: var(--border-thick);
            box-shadow: 8px 8px 0px rgba(0,0,0,0.1);
        }

        .sidebar-header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            text-align: center;
            border-bottom: var(--border-thick);
        }

        .sidebar-header h3 { margin: 0; font-size: 1.2rem; }

        .setting-group { margin-bottom: 20px; }
        .setting-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
        }

        .setting-group label span {
            padding: 2px 6px;
            background: #e8ded0;
            border: 1px solid var(--ink-black);
            color: var(--action-blue);
            font-family: var(--ticker-font);
        }

        .setting-group input:not(.retro-slider) {
            width: 100%;
            padding: 10px;
            background: var(--cardboard);
            border: 2px solid var(--ink-black);
            font-family: var(--ticker-font);
            font-weight: bold;
        }

        .setting-group small { font-size: 11px; color: #666; font-style: italic; }
        .settings-note { padding-top: 15px; font-size: 12px; border-top: 1px dashed var(--ink-black); line-height: 1.4; }

        .retro-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 14px;
            margin: 15px 0;
            background: var(--cardboard);
            border: var(--border-thick);
            cursor: pointer;
            outline: none;
        }

        .retro-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 24px;
            height: 34px;
            background: var(--action-gold);
            border: var(--border-thick);
            box-shadow: 4px 4px 0px var(--ink-black);
            transition: transform 0.1s;
            cursor: pointer;
        }

        .retro-slider::-moz-range-thumb {
            width: 24px;
            height: 34px;
            background: var(--action-gold);
            border: var(--border-thick);
            box-shadow: 4px 4px 0px var(--ink-black);
            border-radius: 0;
            cursor: pointer;
        }

        .btn-reset {
            width: 100%;
            margin-top: 10px;
            padding: 8px;
            background: #bdc3c7;
            color: var(--ink-black);
            border: 2px solid var(--ink-black);
            font-family: var(--retro-font);
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            box-shadow: 3px 3px 0px var(--ink-black);
            transition: 0.1s;
            cursor: pointer;
            
            &:active {
                transform: translate(2px, 2px); box-shadow: 0px 0px 0px var(--ink-black);
            }
        }
    `;

    private max_rounds_changed(e: InputEvent) {
        const element = e.currentTarget as HTMLInputElement;
        this.max_rounds = parseInt(element.value);
    }

    private trading_duration_changed(e: InputEvent) {
        const element = e.currentTarget as HTMLInputElement;
        this.trading_duration = parseInt(element.value);
    }

    private dice_duration_changed(e: InputEvent) {
        const element = e.currentTarget as HTMLInputElement;
        this.dice_duration = parseInt(element.value);
    }

    private starting_cash_changed(e: InputEvent) {
        const element = e.currentTarget as HTMLInputElement;
        this.starting_cash = parseInt(element.value);
    }

    private reset() {
        this.max_rounds = DEFAULT_SETTINGS.max_rounds;
        this.trading_duration = DEFAULT_SETTINGS.trading_duration;
        this.dice_duration = DEFAULT_SETTINGS.dice_duration;
        this.starting_cash = DEFAULT_SETTINGS.starting_cash;
    }

    render() {
        return html`
            <aside id="hostSidebar" class="host-sidebar">
                <div class="sidebar-header"> <h3> ⚙️ GAME SETTINGS </h3> </div>

                <div class="setting-group">
                    <label> Max Rounds: <span id="val_rounds">${this.max_rounds}</span> </label>
                    <input
                        class="retro-slider"
                        type="range"
                        min="1"
                        max="50"
                        .value=${this.max_rounds.toString()}
                        @input=${this.max_rounds_changed}
                    >
                </div>
                
                <div class="setting-group">
                    <label>
                        Trading Timer:
                        <span id="val_trading">
                            ${this.trading_duration}
                        </span>
                        min
                    </label>
                    <input
                        class="retro-slider"
                        type="range"
                        min="1"
                        max="10"
                        .value=${this.trading_duration.toString()}
                        @input=${this.trading_duration_changed}
                    >
                </div>

                <div class="setting-group">
                    <label> Dice Timer: <span id="val_dice">${this.dice_duration}</span> sec </label>
                    <input
                        class="retro-slider"
                        type="range"
                        min="0"
                        max="30"
                        .value=${this.dice_duration.toString()}
                        @input = ${this.dice_duration_changed}
                    >
                </div>

                <div class="setting-group">
                    <label>
                        Starting Cash:
                        <span id="val_cash">
                            $${format_money(this.starting_cash)}
                        </span>
                        </label>
                    <input
                        class="retro-slider"
                        type="range"
                        min="50000"
                        max="2000000"
                        step="50000"
                        .value=${this.starting_cash.toString()}
                        @input=${this.starting_cash_changed}
                    >
                </div>
                
                <button class="btn-reset" @click=${this.reset}> ↻ Reset Defaults </button>
            </aside>
        `;
    }
}