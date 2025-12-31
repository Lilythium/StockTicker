import { GameId } from "./index.js";

export type JoinGameMessage = {
    game_id: GameId,
    player_name: string,
};