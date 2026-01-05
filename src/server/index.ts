import express from "express";
import cookieParser from "cookie-parser";
import http from "http";
import GameManager from "./game_manager.js";
import { PlayerToken } from "../interface/index.js";

// Create server
const app = express();
const server = http.createServer(app);
const game_manager = new GameManager(server);

// Setup pug templating
app.set("view engine", "pug");
app.set("views", "views");

// Routes for static assets
app.use(express.static("assets"));
app.use("/js/client", express.static("dist/client"));
app.use("/js/interface", express.static("dist/interface"));

// Parse url encoded form data and cookies
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Setup main route
app.get("/", (req, res) => {
    const { game_id } = req.query;
    
    if (game_id === undefined) {
        res.render("lobby");
        return;
    }

    let player_token = req.cookies.player_token as PlayerToken;
    let player = game_manager.get_player(player_token);
    if (player === undefined || player.game().id() !== game_id) {
        res.render("lobby", { game_id });
        return;
    }

    const game = player.game();
    switch(player.game().status()) {
        case "waiting":
            res.render("waiting_room", {
                game_id,
                is_host: game.is_host(player.id()),
                settings: game.settings()
            });
            break;
        case "active":
            res.render("game", {
                game_id,
                player_name: player.name()
            })
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
        game_manager.post_game_update(game_id);

        // Redirect to waiting room
        res.redirect(`/?game_id=${game_id}`);
    } else {
        // TODO: Game already in session error
        res.status(409);
        res.send("Game already in session");
    }
});

// Start server
server.listen(9999, () => {
    console.log("Server running on port 9999");
});