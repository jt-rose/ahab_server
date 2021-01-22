import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core";
import { Request, Response } from 'express'
import { Session } from 'express-session'

export type MyContext = {
    em: EntityManager<any> & EntityManager<IDatabaseDriver<Connection>>,
    req: Request & { session: IGetUserIDSession},
    res: Response
}

interface IGetUserIDSession extends Session {
    userId?: number;
}

/*
declare module 'express-session' {
    interface SessionData {
        user?: string;
    }
}
*/