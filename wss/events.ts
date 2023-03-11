export interface Event<T> {
    type: string;
    payload?: T
}

export interface Payload {}
export interface AuthPayload extends Payload {
    token: string
}
export interface TokenPayload {
    username: string
    uuid: string
    device: string
    iat: number
    exp: number
}
