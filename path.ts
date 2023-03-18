import url from "url"

export const root = url.fileURLToPath(new URL('.', import.meta.url));