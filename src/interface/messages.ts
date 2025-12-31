import { GameId, PlayerId } from "./index.js";

export type JoinGameMessage = {
    game_id: GameId,
    player_id: PlayerId,
    player_name: string,
    player_count: number
};