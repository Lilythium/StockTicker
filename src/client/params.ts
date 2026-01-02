export const ORIGIN = window.location.origin;

const PARAMS = new URLSearchParams(window.location.search);
export const GAME_ID = PARAMS.get("game_id");
export const CURRENT_PLAYER_ID =
  document.cookie
    .split("; ")
    .find(c => c.startsWith("player_id="))
    ?.split("=")[1] ?? null;