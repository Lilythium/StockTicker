import { DEFAULT_SETTINGS, GameSettings } from "../../interface/index.js";
import { format_money } from "../params.js";

export default class HostSidebar extends HTMLElement {
    #settings: GameSettings = DEFAULT_SETTINGS;

    constructor() {
        super();
    }

    get settings(): GameSettings {
        return this.#settings;
    }

    connectedCallback() {
        this.render();

        document.getElementById('range_max_rounds')?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            this.#settings.max_rounds = parseInt(target.value);
            document.getElementById('val_rounds')!.textContent = target.value;
        });

        document.getElementById('range_trading_duration')?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            this.#settings.trading_duration = parseInt(target.value);
            document.getElementById('val_trading')!.textContent = target.value;
        });

        document.getElementById('range_dice_duration')?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            this.#settings.dice_duration = parseInt(target.value);
            document.getElementById('val_dice')!.textContent = target.value;
        });

        document.getElementById('range_starting_cash')?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            this.#settings.starting_cash = parseInt(target.value);
            document.getElementById('val_cash')!.textContent = "$" + format_money(parseInt(target.value));
        });
    }

    private render() {
        this.innerHTML = `
            <aside id="hostSidebar" class="host-sidebar"
                <div class="sidebar-header"> <h3> ⚙️ GAME SETTINGS </h3> </div>

                <div class="setting-group">
                    <label> Max Rounds: <span id="val_rounds">${this.#settings.max_rounds}</span> </label>
                    <input
                        id="range_max_rounds"
                        class="retro-slider"
                        type="range"
                        min="1"
                        max="50"
                        value="${this.#settings.max_rounds}"
                    >
                </div>
                
                <div class="setting-group">
                    <label>
                        Trading Timer:
                        <span id="val_trading">
                            ${this.#settings.trading_duration}
                        </span>
                        min
                    </label>
                    <input
                        id="range_trading_duration"
                        class="retro-slider"
                        type="range"
                        min="1"
                        max="10"
                        value="${this.#settings.trading_duration}"
                    >
                </div>

                <div class="setting-group">
                    <label> Dice Timer: <span id="val_dice">${this.#settings.dice_duration}</span> sec </label>
                    <input
                        id="range_dice_duration"
                        class="retro-slider"
                        type="range"
                        min="0"
                        max="30"
                        value="${this.#settings.dice_duration}"
                    >
                </div>

                <div class="setting-group">
                    <label>
                        Starting Cash:
                        <span id="val_cash">
                            $${format_money(this.#settings.starting_cash)}
                        </span>
                        </label>
                    <input
                        id="range_starting_cash"
                        class="retro-slider"
                        type="range"
                        min="50000"
                        max="2000000"
                        step="50000"
                        value="${this.#settings.starting_cash}"
                    >
                </div>
                
                <button id="resetBtnclass" class="btn-reset"> ↻ Reset Defaults </button>
            </aside>
        `;
    }
}

customElements.define("host-sidebar", HostSidebar);