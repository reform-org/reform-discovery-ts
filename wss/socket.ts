import { createServer } from "https";
import { readFileSync } from "fs";
import { createServer as createHttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { AuthPayload, Event, FinishConnectionPayload, Payload, TokenPayload, TransmitTokenPayload, WhitelistPayload } from "./events";
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

    ws.on("close", async () => {
        connections.removePeer(ws)
        await connections.broadcastConnectionInfo()
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

                // send information to client about all connections that should happen automatically now
                const connectableUsers = await user.getConnectableUsers()
                for (let client of connectableUsers) {
                    connections.getPeers(client).forEach(p => {
                        connections.connect(p, peer)
                    })
                }

                await connections.broadcastConnectionInfo()
            });
        })
        .on("host_token", (payload: TransmitTokenPayload) => {
            const peer = connections.getPeer(ws)
            if (!peer) return;
            const connection = connections.getConnection(payload.connection)
            connection.host.token = payload.token
            connection.requestClientToken()
        })
        .on("client_token", (payload: TransmitTokenPayload) => {
            const peer = connections.getPeer(ws)
            if (!peer) return;
            const connection = connections.getConnection(payload.connection)
            connection.client.token = payload.token

            connection.requestClientFinishConnection()
            connection.requestHostFinishConnection()
        })
        .on("finish_connection", (payload: FinishConnectionPayload) => {
            const peer = connections.getPeer(ws)
            if (!peer) return;

            const connection = connections.getConnection(payload.connection)

            connection.finish(ws)
        })
        .on("request_available_clients", async (data) => {
            await connections.getPeer(ws).sendConnectionInfo()
        })
        .on("whitelist_add", async (payload: WhitelistPayload) => {
            const peer = connections.getPeer(ws)
            if (!peer) return;

            const userToTrust = await (new User()).load(payload.uuid)
            if (!userToTrust) return;

            peer.user.trust(userToTrust)

            // connect to the new user if he is trusted
            const connectableUsers = await peer.user.getConnectableUsers()
            for (let client of connectableUsers.filter(p => p.id === userToTrust.id)) {
                connections.getPeers(client).forEach(p => {
                    connections.connect(p, peer)
                })
            }

            await peer.sendConnectionInfo()
            await Promise.all(connections.getPeers(peer.user).map(p => p.sendConnectionInfo()))
        })
        .on("whitelist_del", async (data) => {
            // const user = clientToUser.get(ws);
            // const uuid = data.uuid;
            // if (!uuid) return;
            // const userEntry = await db.get("SELECT * FROM users WHERE uuid = ?", uuid);
            // if (!userEntry) return;

            // db.instance.run("DELETE FROM trust WHERE a = ? AND b = ?", user.id, userEntry.id);

            // const mutualTrust = await db.get("SELECT (EXISTS(SELECT * FROM trust WHERE a = ? AND b = ?) AND EXISTS(SELECT * FROM trust WHERE a = ? AND b = ?)) as mutualTrust", user.id, userEntry.id, userEntry.id, user.id)
            // if(!mutualTrust.mutualTrust) {
            //     console.log("no mutual trust")
            //     // const connectionsToKill = [];
            //     // for(let [host, connection] of establishedConnections){
            //     //     if(clientToUser.get(host).uuid === user.uuid && clientToUser.get(connection.ws)?.uuid === userEntry.uuid){
            //     //         connectionsToKill.push({a: host, b: connection.ws, id: connection.id})
            //     //     }
            //     // }

            //     // for(let connection of connectionsToKill){
            //     //     connection.a.send(JSON.stringify({type: "connection_closed", payload: {id: connection.id}}))
            //     //     connection.b.send(JSON.stringify({type: "connection_closed", payload: {id: connection.id}}))
            //     //     establishedConnections.set(connection.a, (establishedConnections.get(connection.a) || []).filter(w => w.ws !== connection.b));
            //     //     establishedConnections.set(connection.b, (establishedConnections.get(connection.b) || []).filter(w => w.ws !== connection.a));

            //     // }
            // }

            // sendAvailableClients(ws);
            // for (let client of (uuidToClients.get(uuid) || [])) {
            //     sendAvailableClients(client);
            // }
        })
});

webSocketServer.on('upgrade', (req, res, head) => {
    wss.handleUpgrade(req, res, head, (ws) => {
        wss.emit("connection", ws);
    });
});

export default webSocketServer;