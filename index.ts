import app from './rest/server';
import dotenv from "dotenv";
import webSocketServer from './wss/socket';

dotenv.config();

app.listen(process.env.API_PORT || 3000, () => {
  console.log(`REST server listening on port ${process.env.VITE_DISCOVERY_SERVER_LISTEN_PORT || 3000}`);
});

webSocketServer.listen(process.env.WSS_PORT || 7071, () => {
  console.log(`WSS server listening on port ${process.env.VITE_DISCOVERY_SERVER_WEBSOCKET_LISTEN_PORT || 7071}`);
});