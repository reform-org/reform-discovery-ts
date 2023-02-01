import app from './rest/server';
import dotenv from "dotenv";

dotenv.config();

const API_PORT = process.env.API_PORT || 3000;
app.listen(API_PORT, () => {
  console.log(`REST server listening on port ${API_PORT}`);
});