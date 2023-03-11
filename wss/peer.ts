import { ping, send } from "./helpers"
import { generateTurnKey, TurnKey } from "./turn"
import { User } from "./user"
import { WebSocket } from "ws";

export class Peer {
    device: string
    turnKey: TurnKey
    user: User
    socket: WebSocket
    private pingCount: number = 0

    public constructor(device: string, user: User, socket: WebSocket) {
        this.device = device
        this.user = user
        this.socket = socket
        this.turnKey = generateTurnKey() 

        this.initPingSequence()
    }

    public ping(): void {
        ping(this.socket)
        this.pingCount++;
    }

    public registerPong(): void {
        this.pingCount = 0
    }

    private initPingSequence() {
        setInterval(() => {
            if (this.pingCount >= 2) {
                this.socket.close();
            } else {
                this.ping();
            }
        }, 10000);
    }
}