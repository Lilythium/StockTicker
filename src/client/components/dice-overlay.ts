import {css, html, LitElement} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import { RollEvent } from '../../common/index.js';
import { AUDIO_ASSETS, play_audio } from '../audio.js';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function play_shaking() {
    const shakes = AUDIO_ASSETS.shakes;
    const shake = shakes[Math.floor(Math.random() * shakes.length)];
    return play_audio(shake);
}

function play_landing() {
    const lands = AUDIO_ASSETS.lands;
    const land = lands[Math.floor(Math.random() * lands.length)];
    return play_audio(land);
}

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

            play_shaking();
            await sleep(500);
            this.stock_rolling = false;
            play_landing();
            await sleep(250);
            play_shaking();
            await sleep(500);
            this.action_rolling = false;
            play_landing();
            await sleep(250);
            play_shaking();
            await sleep(500);
            this.amount_rolling = false;
            play_landing();
            await sleep(500);
            await sleep(250);
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
                    >${this.action_rolling ? "?" : this.current.movement.toUpperCase()}</div>
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