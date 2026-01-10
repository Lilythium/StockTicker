import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import { RollEvent } from '../../common/index.js';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

@customElement("dice-overlay")
export default class DiceOverlay extends LitElement {
    queue: RollEvent[] = [];

    playing: boolean = false;

    @state()
    current: RollEvent | undefined;

    @state()
    stock_rolling: boolean = false;
    
    @state()
    action_rolling: boolean = false;

    @state()
    amount_rolling: boolean = false;

    @state()
    finished: boolean = false;

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    enqueue(event: RollEvent) {
        this.queue.push(event);

        if(!this.playing) {
            this.play();
        }
    }

    async play() {
        this.playing = true;

        while(this.current = this.queue.shift()) {
            this.stock_rolling = true;
            this.action_rolling = true;
            this.amount_rolling = true;


            await sleep(500);
            this.stock_rolling = false;
            await sleep(500);
            this.action_rolling = false;
            await sleep(500);
            this.amount_rolling = false;
            await sleep(500);
            this.finished = true;

            await sleep(500);
            this.finished = false;
            this.current = undefined;

            await sleep(500);
        }

        this.playing = false;
    }

    render() {
        if (!this.current) return;

        let result = `${this.current.stock} ${this.current.movement.toUpperCase()} ${this.current.amount}`;
        if (!this.current.success) result = `Dividends for ${this.current.stock} not payable.`;

        return html`
            <div
                id="dice-overlay"
                class="dice-overlay"
            >
                <div class="dice-tray">
                    <div
                        class="die ${this.stock_rolling ? "rolling" : "die-reveal"}"
                    >${this.stock_rolling ? "?" : this.current.stock}</div>
                    <div
                        class="die ${this.action_rolling ? "rolling" : "die-reveal"}"
                    >${this.action_rolling ? "?" : this.current.movement}</div>
                    <div
                        class="die ${this.amount_rolling ? "rolling" : "die-reveal"}"
                    >${this.amount_rolling ? "?" : this.current.amount}</div>
                </div>
                <div
                    class="dice-result-text"
                >${this.finished ? result : "Rolling..." }</div>
            </div>
        `;
    }
}