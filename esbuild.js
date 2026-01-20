import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: {
        lobby: 'src/client/views/lobby.ts',
        waiting_room: 'src/client/views/waiting_room.ts',
        game: 'src/client/views/game.ts',
        game_over: 'src/client/views/game_over.ts',
    },
    bundle: true,
    outdir: 'dist/client',
    platform: 'browser',
    format: 'esm',
    splitting: true,
    sourcemap: true
});