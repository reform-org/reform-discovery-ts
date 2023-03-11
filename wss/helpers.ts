import { WebSocket } from "ws";
import { Event } from "./events";

export const ping = (ws: WebSocket) => {
    send(ws, {type: "ping"})
};

export const send = (ws: WebSocket, event: Event<any>) => {
    ws.send(JSON.stringify(event))
}