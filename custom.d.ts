import { User } from "./wss/user";

declare global {
   namespace Express {
    export interface Request {
       user?: User
    }
 }
}