import { WebSocket } from "ws";
import { Event } from "./types";

export const ping = (ws: WebSocket) => {
    send(ws, {type: "ping"})
};

const send = (ws: WebSocket, event: Event<any>) => {
    ws.send(JSON.stringify(event))
}