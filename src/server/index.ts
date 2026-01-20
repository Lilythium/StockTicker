import express from "express";
import cookieParser from "cookie-parser";
import http from "http";
import GameManager from "./game_manager.js";
import { GameId, PlayerToken } from "../common/index.js";

// Create server
const app = express();
const server = http.createServer(app);
export const game_manager = new GameManager(server);

// Setup pug templating
app.set("view engine", "pug");
app.set("views", "views");

// Routes for static assets and client code
app.use(express.static("assets"));
app.use("/js", express.static("dist/client"));

// Parse url encoded form data and cookies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Setup main route
app.get("/", (req, res) => {
    const { game_id } = req.query;
    
    if (game_id === undefined) {
        res.render("index", { view: "lobby-view" });
        return;
    }

    let player_token = req.cookies.player_token as PlayerToken;
    let player = game_manager.get_player(player_token);
    if (player === undefined || player.game().id() !== game_id) {
        res.render("index", { view: "lobby-view" });
        return;
    }

    const game = player.game();
    switch(player.game().status()) {
        case "waiting":
            res.render("index", { view: "waiting-room-view" });
            break;
        case "active":
            res.render("index", { view: "game-view" });
            break;
        case "finished":
            res.render("index", { view: "game-over-view" });
            break;
    }
});

// Join submission
app.post("/join", (req, res) => {
    const { game_id, player_name } = req.body;
    let game = game_manager.get_or_create_game(game_id);

    if (game.status() === "waiting") {
        // Create player and send token & id to client
        const result  = game_manager.add_player(game_id, player_name);
        if(!result) {
            // TODO: Player join error
            res.status(409);
            res.send("Join failed");
            return;
        }
        const [player_token, player] = result;
        res.cookie("player_token", player_token, {
            httpOnly: true,
            maxAge: 24*60*60*1000
        });
        res.cookie("player_id", player.id(), {
            httpOnly: false,
            maxAge: 24*60*60*1000
        });

        // Update waiting room
        game.post_update();

        // Redirect to waiting room
        res.redirect(`/?game_id=${game_id}`);
    } else {
        // TODO: Game already in session error
        res.status(409);
        res.send("Game already in session");
    }
});

// Results request
app.get("/results", (req, res) => {
    const { game_id } = req.query;
    const game = game_manager.get_game(game_id as GameId);

    if (game == undefined) {
        res.status(404);
        res.send("Game doesn't exist or has expired.");
        return;
    }

    const state = game.state();

    if (state.status !== "finished") {
        res.status(409);
        res.send("Game hasn't finished.");
        return;
    }

    res.json(state);
});

// Start server
server.listen(9999, () => {
    console.log("Server running on port 9999");
});