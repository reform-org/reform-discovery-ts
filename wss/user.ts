import { db } from "../utils/db"

export class User {
    name: string
    id: string
    displayId: string

    public constructor();
    public constructor(uuid: string, name: string);
    public constructor(uuid?: string, name?: string) {
        this.id = uuid ?? ""
        this.name = name ?? ""
        this.displayId = uuid ? uuid.substring(0, 8) : ""
    }

    public async load(uuid: string) {
        const user = await db.get("SELECT * FROM users WHERE uuid = ?", uuid)
        if (user) {
            this.name = user.name
            this.id = user.uuid
            this.displayId = user.uuid.substring(0, 8)
        }

        return this
    }


    public async getConnectableUsers(): Promise<Array<User>> {
        const users = (
            await db.all(`
                SELECT name, uuid FROM users 
                WHERE EXISTS(SELECT * FROM trust WHERE (a = ? AND b = id)) 
                AND EXISTS(SELECT * FROM trust WHERE (a = id AND b = ?)) 
                AND EXISTS(SELECT * FROM devices WHERE user_uuid = ?)`, this.id, this.id, this.id)
        ).map(user => new User(user.uuid, user.name));

        return users
    }

    public async getAvailableUsers(): Promise<Array<User>> {
        const users = (
            await db.all(`
            SELECT name, uuid, 
            EXISTS(SELECT * FROM trust WHERE a = ? AND b = id) as trusted, 
            (EXISTS(SELECT * FROM trust WHERE a = ? AND b = id) AND EXISTS(SELECT * FROM trust WHERE a = id AND b = ?)) as mutualTrust 
            FROM users 
            WHERE (EXISTS(SELECT * FROM trust WHERE a = ? AND b = id) 
            AND EXISTS(SELECT * FROM trust WHERE a = id AND b = ?)) = FALSE 
            AND NOT id = ? 
            AND EXISTS(SELECT * FROM devices WHERE user_uuid = ?)`, this.id, this.id, this.id, this.id, this.id, this.id, this.id)
        ).map(user => new User(user.uuid, user.name));

        return users
    }
}