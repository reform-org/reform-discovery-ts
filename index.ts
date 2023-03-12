import app from './rest/server';
import dotenv from "dotenv";
import webSocketServer from './wss/socket';
import { db } from "./utils/db";
import { Mailer } from './rest/mailer';

dotenv.config();

db.init();

(async () => {
  const mailer = Mailer.getInstance()
  await mailer.createConnection()
})();

app.listen(process.env.VITE_DISCOVERY_SERVER_LISTEN_PORT || 3000, () => {
  console.log(`REST server listening on port ${process.env.VITE_DISCOVERY_SERVER_LISTEN_PORT || 3000}`);
});

webSocketServer.listen(process.env.VITE_DISCOVERY_SERVER_WEBSOCKET_LISTEN_PORT || 7071, () => {
  console.log(`WSS server listening on port ${process.env.VITE_DISCOVERY_SERVER_WEBSOCKET_LISTEN_PORT || 7071}`);
});