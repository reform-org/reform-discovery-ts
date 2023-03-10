import { createServer } from "https";
import { readFileSync } from "fs";
import { createServer as createHttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { AuthPayload, Event, Payload, PingPayload, TokenPayload } from "./types";
import jwt from "jsonwebtoken";
import { db } from "../utils/db";
import { ping } from "./helpers";

export const webSocketServer = process.env.HTTPS === "TRUE" ? createServer({
    cert: readFileSync(process.env.CERT_PATH),
    key: readFileSync(process.env.KEY_PATH)
}) : createHttpServer();

const wss = new WebSocketServer({ noServer: true });

const pings = new Map<WebSocket, number>();
const authenticatedClients = new Map<WebSocket, TokenPayload>();
const authenticatedClientsForUuid = new Map<string, Array<WebSocket>>();
const getWSForUser = (uuid: string) => authenticatedClientsForUuid.get(uuid);
const addWSForUser = (uuid: string, ws: WebSocket) => authenticatedClientsForUuid.set(uuid, [...(authenticatedClientsForUuid.get(uuid) || []), ws])

db.instance.exec("DELETE FROM devices")

wss.on("connection", (ws: WebSocket) => {
    ws.on("error", console.error);
    pings.set(ws, 0);

    setInterval(() => {
        const sentPings = pings.get(ws);
        if (sentPings >= 2) {
            ws.close();
        } else {
            ping(ws);
            pings.set(ws, sentPings + 1);
        }
    }, 10000);

    ws.on("close", () => {
        const token = authenticatedClients.get(ws)
        db.instance.run("DELETE FROM devices WHERE device_uuid = ?", token.device);
        authenticatedClients.delete(ws);
    });

    ws.on("message", function (message) {
        try {
            const event: Event<Payload> = JSON.parse(message.toString());
            if (event.type === "pong" || event.type === "authenticate" || authenticatedClients.has(ws)) {
                this.emit(event.type, event.payload);
            }
        } catch (err) {
            console.log('not an event', err);
        }
    })
        .on("pong", (payload: PingPayload) => {
            pings.set(ws, 0);
        })
        .on("authenticate", (payload: AuthPayload) => {
            jwt.verify(payload.token, process.env.JWT_KEY, async (err, tokenPayload: TokenPayload) => {
                if (err) {
                    ws.close();
                    return;
                };

                authenticatedClients.set(ws, tokenPayload);
                addWSForUser(tokenPayload.uuid, ws);

                db.instance.run("INSERT OR REPLACE INTO devices VALUES(?, ?)", tokenPayload.uuid, tokenPayload.device);

                // const user = await db.get("SELECT id, uuid, name FROM users WHERE uuid = ?", tokenPayload.uuid);

                // // send information to client about all connections that should happen automatically now
                // const eligibleUsers = await db.all("SELECT name, uuid FROM users WHERE EXISTS(SELECT * FROM trust WHERE (a = ? AND b = id)) AND EXISTS(SELECT * FROM trust WHERE (a = id AND b = ?)) AND online = 1 AND NOT id = ?", user.id, user.id, user.id);
                // for (let clientUser of eligibleUsers) {
                //     initializeConnection(ws, user, clientUser);
                // }

                // // connect to all own peers
                // initializeConnection(ws, user, user);

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