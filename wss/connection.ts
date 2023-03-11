import { randomUUID } from "crypto";
import { Peer } from "./peer";

export enum ConnectionState {
    Pending,
    Connected,
}

export class Connection{
    host: Peer
    client: Peer
    id: string
    state: ConnectionState = ConnectionState.Pending

    public constructor(host: Peer, client: Peer) {
        this.client = client
        this.host = host
        this.id = randomUUID()
    }
}