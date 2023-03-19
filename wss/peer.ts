import { ping, send } from "./helpers.js"
import { generateTurnKey, TurnKey } from "./turn.js"
import { User } from "./user.js"
import { WebSocket } from "ws";

export class Peer {
    device: string
    turnKey: TurnKey
    user: User
    socket: WebSocket
    token: string
    private pingCount: number = 0
    private lastConnectionInfo: Array<User> = null

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
        // send available peers, that is user * number of peers with this user
        const connectionInfo = await this.user.getAvailableUsers()
        if(this.lastConnectionInfo !== null && JSON.stringify(connectionInfo) === JSON.stringify(this.lastConnectionInfo)) return
        send(this.socket, {type: "available_clients", payload: {clients: connectionInfo}})
    }

    public toJSON() {
        return {
            device: this.device,
            turnKey: this.turnKey,
            user: this.user,
            token: this.token
        }
    }
}