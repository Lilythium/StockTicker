const AUDIO_ROOT = "/audio/";

export const AUDIO_ASSETS = {
    shakes: [
        'dice_shakes/shuffle_open_1.mp3',
        'dice_shakes/shuffle_open_2.mp3',
        'dice_shakes/shuffle_open_3.mp3',
        'dice_shakes/shuffle_open_4.mp3'
    ],
    lands: [
        'dice_lands/d6_floor_1.mp3',
        'dice_lands/d6_floor_2.mp3',
        'dice_lands/d6_floor_3.mp3',
        'dice_lands/d6_floor_4.mp3'
    ],
    ui: {
        click: 'button-click.ogg',
        game_over: 'game-complete.mp3',
        phase_change: 'game-phase-change.mp3',
        game_start: 'game-start.mp3',
        your_roll: 'your-turn.mp3'
    }
};

export function play_audio(asset: string) {
    const file = `${AUDIO_ROOT}${asset}`;
    const audio = new Audio(file);
    audio.play().catch(e => console.log("Audio blocked"));
    return audio;
}