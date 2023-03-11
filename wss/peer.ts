import { generateTurnKey, TurnKey } from "./turn"
import { User } from "./user"

export class Peer {
    device: string
    turnKey: TurnKey
    user: User
    socket: WebSocket

    public constructor(device: string, user: User, socket: WebSocket) {
        this.device = device
        this.user = user
        this.socket = socket
        this.turnKey = generateTurnKey() 
    }
}