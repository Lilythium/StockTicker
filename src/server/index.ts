import express from "express";
import http from "http";
import sockets from "./sockets";

const app = express();
const server = http.createServer(app);
sockets(server);

app.use(express.static("web"));

server.listen(9999, () => {
    console.log("Server running on port 9999");
});