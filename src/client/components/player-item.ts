export default class PlayerItem extends HTMLElement {
    constructor() {
        super();
    }

    static get observedAttributes() {
        return ["empty", "name", "you", "host", "connected"];
    }

    set empty(value: boolean) {
        this.toggleAttribute("empty", value);
    }

    set name(value: string) {
        this.setAttribute("name", value);
    }

    set you(value: boolean) {
        this.toggleAttribute("you", value);
    }

    set host(value: boolean) {
        this.toggleAttribute("host", value);
    }

    set connected(value: boolean) {
        this.toggleAttribute("connected", value);
    }

    attributesChangedCallback() {
        this.render();
    }

    connectedCallback() {
        this.render();
    }

    private render() {
        const is_empty = this.hasAttribute("empty");
        const name = this.getAttribute("name") ?? "Unknown";
        const is_you = this.hasAttribute("you");
        const is_host = this.hasAttribute("host");
        const is_connected = this.hasAttribute("connected");

        if (is_empty) {
            this.innerHTML = `<div class="empty-slot">Waiting for player...</div>`;
            return;
        }

        this.innerHTML = `
            <div class="player-item ${is_you ? 'you' : ''} ${is_host ? 'host' : ''}">
                <div class="player-name">
                    ${name}
                    ${is_you ? '<span class="player-badge you">You</span>' : ''}
                    ${is_host ? '<span class="player-badge host">Host</span>' : ''}
                    ${!is_connected ? '<span class="player-badge disconnected">OFFLINE</span>' : ''}
                </div>
                <div class="player-status">${!is_connected ? '⌛ Wait' : 'Ready ✅'}</div>
            </div>
        `;
    }
}

customElements.define("player-item", PlayerItem);