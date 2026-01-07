import {html, LitElement, TemplateResult} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import { CURRENT_PLAYER_ID, GAME_ID } from "../params.js";
import {
    GameState,
    MAX_PLAYERS,
    WaitingGameState
} from "../../common/index.js";
import SocketClient from "../socket_client.js";

import "../components/share-link.js";
import "../components/player-item.js";
import "../components/host-sidebar.js";
import HostSidebar from "../components/host-sidebar.js";

@customElement("waiting-room-view")
export default class WaitingRoomView extends LitElement {
    private socket_client: SocketClient;
    
    @state()
    private game_state: WaitingGameState | undefined;

    @query('#hostSidebarComponent')
    private host_sidebar!: HostSidebar;

    constructor() {
        super();
        this.socket_client = new SocketClient("waiting", io => {
            io.on("update", (game_state: GameState) => {
                if (game_state.status != "waiting") return;
                this.game_state = game_state;
            });
        });
    }

    // use light dom
    protected createRenderRoot(): HTMLElement | DocumentFragment { return this; }

    start_game() {
        this.socket_client.start_game(this.host_sidebar.settings);
    }

    render() {
        const player_count = `${this.game_state?.players.length ?? 0}/${MAX_PLAYERS}`
        const is_host = this.game_state?.host_id === CURRENT_PLAYER_ID;

        const players = this.game_state?.players;
        let player_list: TemplateResult[] = [];
        let active_players = 0;
        let i = 0;

        for (i; i < (players?.length ?? 0); i++) {
            const [id, state] = players![i];
            if (state.is_connected) active_players++;

            player_list.push(html`
                <player-item
                    .name=${state.name}
                    ?you=${id === CURRENT_PLAYER_ID}
                    ?host=${id === this.game_state!.host_id}
                    ?connected=${state.is_connected}
                ></player-item> 
            `);
        }

        for(i; i < MAX_PLAYERS; i++) {
            player_list.push(html`<player-item empty></player-item>`)
        }
        
        const can_start = active_players >= 2;

        return html`
            <div class="page-wrapper">
                <div class="waiting-container">
                    <div class="game-info">
                        <h1> Waiting Room </h1>
                    </div>

                    <div class="game-id-display">
                        <div class="game-id-label"> Game ID </div>
                        <div class="game-id-value"> ${GAME_ID} </div>
                    </div>
                    
                    <share-link></share-link>

                    <div class="players-waiting">
                        <h2>
                            👥 Players (<span id="playerCount">${player_count}</span>)
                        </h2>
                        <div id="playerList" class="player-list">
                            ${player_list}
                        </div>
                    </div>
                    
                    ${is_host
                        ? html`
                            <div id="hostControls">
                                <button
                                    id="startGameBtn"
                                    class="start-button"
                                    ?disabled=${!can_start}
                                    @click=${this.start_game}
                                >
                                    ${can_start ? "Start Game" : "⛔ Need 2+ Players"}
                                </button>
                            </div>
                        `
                        : html`
                            <div
                                id="waitingMessage"
                                style="text-align: center; padding: 20px;"
                            > ⏳ Waiting for host to start the game... </div> 
                        `
                    }

                    <div
                        class="action-buttons"
                        style="margin-top: 20px; text-align: center;"
                    >
                        <button id="leaveBtn" class="btn-leave"> Leave Game </button>
                    </div>
                </div>
                    
                ${is_host
                    ? html`
                        <host-sidebar id="hostSidebarComponent">
                        </host-sidebar>
                    `
                    : html``
                };
            </div>
        `;
    }
}