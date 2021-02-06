import { createUpdootLoader } from './utils/createUpdootLoader'
import { createUserLoader } from './utils/createUserLoader'
import { Request, Response } from 'express'
import { Session } from 'express-session'
import { Redis } from 'ioredis'

export type MyContext = {
  req: Request & { session: IGetUserIDSession }
  res: Response
  redis: Redis
  userLoader: ReturnType<typeof createUserLoader>
  updootLoader: ReturnType<typeof createUpdootLoader>
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
