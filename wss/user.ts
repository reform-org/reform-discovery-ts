import { db } from "../utils/db"

export class User {
    name: string
    id: string
    displayId: string

    public async get(uuid: string) {
        const user = await db.get("SELECT * FROM users WHERE uuid = ?", uuid)
        if(user){
            this.name = user.name
            this.id = user.uuid
            this.displayId = user.uuid.substring(0, 8)
        }

        return this
    }


}