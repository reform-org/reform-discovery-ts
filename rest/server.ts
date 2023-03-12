import express from "express";
import { db } from "../utils/db";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import { Issuer, generators } from 'openid-client';
import dotenv from "dotenv"
import { authenticateToken } from "./middleware";

dotenv.config()

db.init()

export const app = express();
const serverPath = process.env.VITE_DISCOVERY_SERVER_PATH;

(async () => {
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const issuer = await Issuer.discover("https://login.tu-darmstadt.de")
    const openidClient = new issuer.Client({
        client_id: process.env.SSO_CLIENT_ID,
        client_secret: process.env.SSO_CLIENT_SECRET,
        redirect_uris: ['https://reform.st.informatik.tu-darmstadt.de/api/v1/redirect'],
        response_types: ['code'],
      });


    const error = (message: string, fields: string[] = []) => {
        return {
            error: {
                message,
                fields
            }
        };
    };
    
    app.get(`${serverPath}/redirect`, async (req, res) => {
        const params = openidClient.callbackParams(req)
        const tokenSet = await openidClient.callback('https://reform.st.informatik.tu-darmstadt.de/', params, { code_verifier: codeVerifier });
        console.log('received and validated tokens %j', tokenSet);
        console.log('validated ID Token claims %j', tokenSet.claims());
    })
    
    app.get(`${serverPath}/sso`, async (req, res) => { 
    
        res.json(openidClient.authorizationUrl({
            scope: 'openid uid givenName',
            resource: 'https://my.api.example.com/resource/32178',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
          }))
    })
    
    app.use(bodyParser.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors({ origin: "*" }));
    
    app.post(`${serverPath}/login`, async (req, res) => {
        const username = req.body?.username;
        const password = req.body?.password;
    
        if (!username) return res.status(400).json(error("Username must not be empty!", ["username"]));
        if (!password) return res.status(400).json(error("Password must not be empty!", ["password"]));
    
        const userEntry = await db.get("SELECT * FROM users WHERE name = ?", username);
    
        if (!userEntry) return res.status(404).json(error(`The user "${username}" does not exist. Please contact your admin to add the user manually.`, ["username"]));
    
        if (!bcrypt.compareSync(password, userEntry.password)) return res.status(401).json(error(`The password for the user "${username}" is wrong.`, ["password"]));
    
        const token = jwt.sign({ username, uuid: userEntry.uuid, device: uuidv4() }, process.env.JWT_KEY, { expiresIn: '14d' });
        res.json({ username, token });
    });

    app.post(`${serverPath}/mail`, authenticateToken, async (req, res) => {
        // only x mails per user per day, should be configurable in env
        // log sent emails with sender, reciever and timestamp
        // smtp sending
        // html template
        // attachment
        // sender should be in blind copy

        const replyTo = req.body?.replyTo;
        if (!replyTo) return res.status(400).json(error("ReplyTo must not be empty!", ["replyto"]));
        const html = req.body?.html;
        if (!html) return res.status(400).json(error("HTML must not be empty!", ["html"]));


        res.json({})
    })
})()

export default app