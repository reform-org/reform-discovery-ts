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


    public async getEligibleUsers(): Promise<Array<User>> {
        const eligibleUsers = (
            await db.all(`
                SELECT name, uuid FROM users 
                WHERE EXISTS(SELECT * FROM trust WHERE (a = ? AND b = id)) 
                AND EXISTS(SELECT * FROM trust WHERE (a = id AND b = ?)) 
                AND EXISTS(SELECT * FROM devices WHERE user_uuid = ?)`, this.id, this.id, this.id)
        ).map(user => new User(user.uuid, user.name));

        return eligibleUsers
    }
}