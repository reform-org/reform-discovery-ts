import { ping, send } from "./helpers"
import { generateTurnKey, TurnKey } from "./turn"
import { User } from "./user"
import { WebSocket } from "ws";

export class Peer {
    device: string
    turnKey: TurnKey
    user: User
    socket: WebSocket
    token: string
    private pingCount: number = 0
    private lastConnectionInfo: Array<User> = []

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

    public async sendConnectionInfo() {
        const connectionInfo = await this.user.getAvailableUsers()
        if(JSON.stringify(connectionInfo.map(p => p.id)) === JSON.stringify(this.lastConnectionInfo.map(p => p.id))) return
        send(this.socket, {type: "available_clients", payload: {clients: connectionInfo}})
    }
}