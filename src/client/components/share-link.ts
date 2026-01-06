import { ORIGIN, GAME_ID } from "../params.js";

export default class ShareLink extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
        
        const game_link = document.getElementById("gameLink") as HTMLInputElement;
        const copy_button = document.getElementById("copyButton") as HTMLButtonElement;
        game_link.value = `${ORIGIN}/?game_id=${GAME_ID}`;
        copy_button.addEventListener("click", () => {
            navigator.clipboard.writeText(game_link.value).then(() => {
                copy_button.textContent = 'Copied!';
                copy_button.style.background = '#27ae60';
                
                setTimeout(() => {
                    copy_button.textContent = 'Copy';
                    copy_button.style.background = '';
                }, 2000);
            });
        });
    }

    private render() {
        this.innerHTML = `
            <div class="share-link">
                <p> <strong>📋 Share this link with friends:</strong> <p>
                <div class="copy-link">
                    <input type="text" id="gameLink" readonly>
                    <button id="copyButton" class="copy-button"> Copy </button>
                </div>
            </div>
        `;
    }
}

customElements.define("share-link", ShareLink);