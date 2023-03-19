import express, { Router } from "express"
import { error } from "../helpers.js";
import { serverPath } from "../server.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { randomUUID } from "crypto";
import { Issuer } from "openid-client";
import { ClassicUser, createUser, User, UserTypes } from "../../wss/user.js";

export const authRouter = async () => {
    const redirect_uri = 'https://reform.st.informatik.tu-darmstadt.de/api/v1/redirect'


    const router = express.Router()
    const issuer = await Issuer.discover("https://login.tu-darmstadt.de")
    const openidClient = new issuer.Client({
        client_id: process.env.SSO_CLIENT_ID,
        client_secret: process.env.SSO_CLIENT_SECRET,
        redirect_uris: [redirect_uri],
        response_types: ['code'],
        token_endpoint_auth_method: "client_secret_basic"
    });


    router.get(`${serverPath}/redirect`, async (req, res) => {
        const oidParams = openidClient.callbackParams(req)
        if (!oidParams.code) return res.json(error("query parameter code has not been set", ["code"]))
        if (!oidParams.state) return res.json(error("query parameter state has not been set", ["state"]))

        const state = JSON.parse(Buffer.from(req.query.state.toString(), "base64url").toString("ascii"))

        const params = {
            code: oidParams.code,
            grant_type: "authorization_code"
        }

        try {
            const tokenSet = await openidClient.callback(redirect_uri, params);

            const userinfo = await openidClient.userinfo(tokenSet.access_token);

            const user = createUser(UserTypes.SSO, userinfo.sub, userinfo.given_name)
            user.storeName()

            const token = user.issueToken()
            res.cookie("discovery-token", token.access_token, {maxAge: token.maxAge, httpOnly: true})
            res.redirect(state.goto)
        } catch (e) {
            res.json({ error: e })
        }
    })

    router.get(`${serverPath}/authorize`, async (req, res) => {
        if(!req.query.goto) return res.json(error("Please provide a goto url, to which you will be redirected after successful auth", ["goto"]))
        const state = {
            goto: req.query.goto,
            source: req.baseUrl
        }
        res.redirect(openidClient.authorizationUrl({
            scope: 'openid profile',
            state: Buffer.from(JSON.stringify(state)).toString("base64url")
        }))
    })

    router.post(`${serverPath}/login`, async (req, res) => {
        const username = req.body?.username;
        const password = req.body?.password;

        if (!username) return res.status(400).json(error("Username must not be empty!", ["username"]));
        if (!password) return res.status(400).json(error("Password must not be empty!", ["password"]));

        const user = await new ClassicUser().fromName(username)

        if (!user || !user.id || user.id === "") return res.status(404).json(error(`The user "${username}" does not exist. Please contact your admin to add the user manually.`, ["username"]));

        if (!user.isPasswordValid(password)) return res.status(401).json(error(`The password for the user "${username}" is wrong.`, ["password"]));

        const token = user.issueToken();
        res.json({ username, token: token.access_token });
    });

    return router
}