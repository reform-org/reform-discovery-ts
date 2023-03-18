import { db } from "../utils/db.js"
import bcrypt from "bcrypt"
import { randomUUID } from "crypto"
import jwt from "jsonwebtoken"

export class User {
    name: string
    id: string
    displayId: string

    public constructor();
    public constructor(uuid: string, name: string);
    public constructor(uuid?: string, name?: string) {
       this.apply(uuid, name)
    }

    protected apply(uuid?: string, name?: string) {
        this.id = uuid ?? ""
        this.name = name ?? ""
        this.displayId = uuid ? uuid.substring(0, 8) : ""
    }

    public async fromUUID(uuid: string) {
        const user = await db.get("SELECT * FROM users WHERE uuid = ?", uuid)
        if (user) {
            this.apply(user.uuid, user.name)
        }

        return this
    }

    public trust(user: User) {
        db.instance.run("INSERT OR REPLACE INTO trust(a, b) VALUES (?, ?)", this.id, user.id);
    }

    public withdrawTrust(user: User) {
        db.instance.run("DELETE FROM trust WHERE a = ? AND b = ?", this.id, user.id);
    }

    public async getConnectableUsers(): Promise<Array<User>> {
        const users = (
            await db.all(`
                SELECT name, uuid, EXISTS(SELECT * FROM devices WHERE user_uuid = uuid) as online FROM users 
                WHERE EXISTS(SELECT * FROM trust WHERE (a = ? AND b = uuid)) 
                AND EXISTS(SELECT * FROM trust WHERE (a = uuid AND b = ?))`, this.id, this.id)
        ).filter(p => p.online).map(user => new User(user.uuid, user.name));

        users.push(this)
        return users
    }

    public async getAvailableUsers(): Promise<Array<AvailableUser>> {
        const users = (
            await db.all(`
            SELECT name, uuid, EXISTS(SELECT * FROM devices WHERE user_uuid = uuid) as online,
            EXISTS(SELECT * FROM trust WHERE a = ? AND b = uuid) as trusted, 
            (EXISTS(SELECT * FROM trust WHERE a = ? AND b = uuid) AND EXISTS(SELECT * FROM trust WHERE a = uuid AND b = ?)) as mutualTrust 
            FROM users 
            WHERE NOT uuid = ?`, this.id, this.id, this.id, this.id)
        ).filter(p => p.online).map(user => new AvailableUser(user.uuid, user.name, user.trusted, user.mutualTrust));
        return users
    }

    public issueToken(): string {
        return jwt.sign({ username: this.name, uuid: this.id, device: randomUUID() }, process.env.JWT_KEY, { expiresIn: '14d' })
    }
}

export class AvailableUser extends User{
    trusted: boolean
    mutualTrust: boolean

    public constructor(id: string, name: string, trusted: boolean, mutualTrust: boolean) {
        super(id, name)
        this.trusted = trusted
        this.mutualTrust = mutualTrust
    }
}

export class ClassicUser extends User{
    password: string

    public constructor() {
       super()
    }

    public async fromName(name: string) {
        const user = await db.get("SELECT * FROM users WHERE name = ?", name)
        if (user) {
            this.apply(user.uuid, user.name)
            this.password = user.password
        }

        return this
    }

    public isPasswordValid(password: string): boolean {
        return bcrypt.compareSync(password, this.password)
    }
}