import { createServer } from "https";
import { readFileSync } from "fs";
import { createServer as createHttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { AuthPayload, Event, Payload, TokenPayload } from "./events";
import jwt from "jsonwebtoken";
import { db } from "../utils/db";
import { ping } from "./helpers";
import { ConnectionManager } from "./connectionManager";
import { Peer } from "./peer";
import { User } from "./user";

export const webSocketServer = process.env.HTTPS === "TRUE" ? createServer({
    cert: readFileSync(process.env.CERT_PATH),
    key: readFileSync(process.env.KEY_PATH)
}) : createHttpServer();

const wss = new WebSocketServer({ noServer: true });

const connections = new ConnectionManager()

db.instance.exec("DELETE FROM devices")

wss.on("connection", (ws: WebSocket) => {
    ws.on("error", console.error);

    ws.on("close", () => {
        connections.removePeer(ws)
    });

    ws.on("message", function (message) {
        try {
            const event: Event<Payload> = JSON.parse(message.toString());
            if (event.type === "pong" || event.type === "authenticate" || connections.getPeer(ws)) {
                this.emit(event.type, event.payload);
            }
        } catch (err) {
            console.log('not an event', err);
        }
    })
        .on("pong", () => {
            connections.getPeer(ws).registerPong()
        })
        .on("authenticate", (payload: AuthPayload) => {
            jwt.verify(payload.token, process.env.JWT_KEY, async (err, tokenPayload: TokenPayload) => {
                if (err) {
                    ws.close();
                    return;
                };

                const user = await (new User()).load(tokenPayload.uuid)
                const peer = new Peer(tokenPayload.device, user, ws)
                connections.addPeer(peer)

                // // send information to client about all connections that should happen automatically now
                const eligibleUsers = await user.getEligibleUsers()
                for (let client of eligibleUsers) {
                    connections.getPeers(client).forEach(p => {
                        connections.connect(p, peer)
                    })
                }

                // await broadcastAvailableClients(clientToUser);
            });
        });
});

webSocketServer.on('upgrade', (req, res, head) => {
    wss.handleUpgrade(req, res, head, (ws) => {
        wss.emit("connection", ws);
    });
});

export default webSocketServer;