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
    const issuer = await Issuer.discover("https://login.tu-darmstadt.de")
    const openidClient = new issuer.Client({
        client_id: process.env.SSO_CLIENT_ID,
        client_secret: process.env.SSO_CLIENT_SECRET,
        redirect_uris: ['https://reform.st.informatik.tu-darmstadt.de/api/v1/redirect'],
        response_types: ['code'],
        token_endpoint_auth_method: "client_secret_basic"
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
        const oidParams = openidClient.callbackParams(req)

        const params = {
            code: oidParams.code,
            grant_type: "authorization_code"
        }
        
        const tokenSet = await openidClient.callback('https://reform.st.informatik.tu-darmstadt.de/api/v1/redirect', params);
        const claims = tokenSet.claims()
        // console.log('received and validated tokens %j', tokenSet);
        console.log('validated ID Token claims %j', claims);
        console.log(`expires in ${Math.round((claims.exp - claims.iat)/60)}min`)
        res.cookie("access_token", tokenSet.access_token)
        res.redirect("https://reform.st.informatik.tu-darmstadt.de")
    })
    
    app.get(`${serverPath}/authorize`, async (req, res) => { 
    
        res.redirect(openidClient.authorizationUrl({
            scope: 'openid',
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

        const options = {from: from, fromName: fromName, to: to, html: html, subject: subject}
        if(req.body?.cc) options["cc"] = req.body.cc
        if(req.body?.bcc) options["bcc"] = req.body.bcc

        if(!Mailer.isSetup()) return res.json({accepted: [], rejected: [to, options["cc"], options["bcc"]].flat().filter(a => a !== "")})

        const mailer = Mailer.getInstance()

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