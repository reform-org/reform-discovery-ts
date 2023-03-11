import { WebSocket } from "ws";
import { db } from "../utils/db";
import { Connection } from "./connection";
import { Peer } from "./peer";
import { User } from "./user";

export class ConnectionManager{
    private connections: Array<Connection> = []
    private peers: Array<Peer> = []

    public addConnection(connection: Connection) {
        this.connections.push(connection)
    }

    public removeConnection(connection: Connection) {
        this.connections = this.connections.filter(p => p.id !== connection.id) 
    }

    public getConnection(id: string) {
        return this.connections[this.connections.findIndex(p => p.id === id)]
    }

    public connect(host: Peer, client: Peer): void {
        if(this.checkConnected(host, client)) return;
        const connection = new Connection(host, client)
        this.addConnection(connection)
        connection.requestHostToken()
    }

    private checkConnected(a: Peer, b: Peer): Boolean {
        return this.connections.filter(p => (p.client === a && p.host === b) || (p.client === b && p.host === a)).length > 0
    }

    public addPeer(peer: Peer) {
        this.peers.push(peer)
        db.instance.run("INSERT OR REPLACE INTO devices VALUES(?, ?)", peer.user.id, peer.device);
    }

    public removePeer(ws: WebSocket) {
        const peer = this.getPeer(ws);
        db.instance.run("DELETE FROM devices WHERE device_uuid = ?", peer.device);
        this.peers = this.peers.filter(p => p.socket !== ws)
        const openConnections = this.connections.filter(p => p.client.socket === ws || p.host.socket === ws)
        openConnections.forEach(connection => connection.close(peer))
        this.connections = this.connections.filter(p => !(p.client.socket === ws || p.host.socket === ws))
    }

    public getPeer(ws: WebSocket) {
        return this.peers.find(p => p.socket == ws)
    }

    public getPeers(user: User) {
        return this.peers.filter(p => p.user.id === user.id)
    }

    public async broadcastConnectionInfo() {
        await Promise.all(this.peers.map(peer => peer.sendConnectionInfo()))
    }
}