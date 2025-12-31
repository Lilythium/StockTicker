import express from "express";
import session from "express-session";
import http from "http";
import sockets from "./sockets.js";

// Setup sockets
const app = express();
const server = http.createServer(app);
sockets(server);

// Setup pug templating
app.set("view engine", "pug");
app.set("views", "views");

// Routes for static assets
app.use(express.static("assets"));
app.use("/js", express.static("dist/client"));

// Setup session middleware
app.use(session({
    secret: crypto.randomUUID(),
    resave: false,
    saveUninitialized: false
}));

// Setup main route
app.get("/", (req, res) => {
    const { game_id } = req.query;
    if (game_id === undefined) {
        res.render("lobby");
        return;
    }
    res.render("lobby", { game_id });
    return;
    res.render("waiting_room", { game_id });
});

// Start server
server.listen(9999, () => {
    console.log("Server running on port 9999");
});