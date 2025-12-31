export const ORIGIN = window.location.origin;

const PARAMS = new URLSearchParams(window.location.search);
export const GAME_ID = PARAMS.get("game_id");
