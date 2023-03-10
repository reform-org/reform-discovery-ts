import express from "express";
import { db } from "../utils/db";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';

export const app = express();

const serverPath = process.env.VITE_DISCOVERY_SERVER_PATH

const error = (message: string, fields: string[] = []) => {
    return {
        error: {
            message,
            fields
        }
    };
};

app.use(bodyParser.json());
app.use(cors({ origin: "*" }));

app.post(`${serverPath}/api/login`, async (req, res) => {
    const username = req.body?.username;
    const password = req.body?.password;

    if (!username) return res.status(400).json(error("Username must not be empty!", ["username"]));
    if (!password) return res.status(400).json(error("Password must not be empty!", ["password"]));

    const userEntry = await db.get("SELECT * FROM users WHERE name = ?", username);

    if (!userEntry) return res.status(404).json(error(`The user "${username}" does not exist. Please contact your admin to add the user manually.`, ["username"]));

    if (!bcrypt.compareSync(password, userEntry.password)) return res.status(401).json(error(`The password for the user "${username}" is wrong.`, ["password"]));

    const token = jwt.sign({ username, uuid: userEntry.uuid, device: uuidv4() }, process.env.JWT_KEY, { expiresIn: '14d' }); // 14 days
    res.json({ username, token });
});

export default app