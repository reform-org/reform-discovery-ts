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
import multer from "multer";
import { Mail, Mailer } from "./mailer";
import { MailOptions } from "nodemailer/lib/json-transport";
import { Attachment } from "nodemailer/lib/mailer";
import { SentMessageInfo } from "nodemailer";

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
    
    app.use(bodyParser.json({limit: '200mb'}));
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
        const from = req.body?.from;
        if (!from) return res.status(400).json(error("from must not be empty!", ["from"]));
        const fromName = req.body?.fromName;
        if (!fromName) return res.status(400).json(error("fromName must not be empty!", ["fromName"]));
        const to = req.body?.to;
        if (!to) return res.status(400).json(error("to must not be empty!", ["to"]));
        const html = req.body?.html;
        if (!html) return res.status(400).json(error("html must not be empty!", ["html"]));
        const subject = req.body?.subject;
        if (!subject) return res.status(400).json(error("subject must not be empty!", ["subject"]));

        const mailer = Mailer.getInstance()
        const options = {from: from, fromName: fromName, to: to, html: html, subject: subject}

        if(req.body?.cc) options["cc"] = req.body.cc
        if(req.body?.bcc) options["bcc"] = req.body.bcc

        if(req.body?.attachments) options["attachments"] = req.body.attachments.map(a => {
            const attachment: Attachment = {
                content: Buffer.from(a.content),
                contentType: a.contentType,
                filename: a.filename
            }
            console.log(attachment, a)
            return attachment
        })

        const mail = new Mail(options)
        const answer: SentMessageInfo = await mailer.send(mail)

        res.json({accepted: answer.accepted, rejected: answer.rejected})
    })
})()

export default app