import { Request, Response } from 'express'
import { Session } from 'express-session'
import { Redis } from 'ioredis'

export type MyContext = {
  req: Request & { session: IGetUserIDSession }
  res: Response
  redis: Redis
}

interface IGetUserIDSession extends Session {
  userId?: number
}

/*
declare module 'express-session' {
    interface SessionData {
        user?: string;
    }
}
*/
