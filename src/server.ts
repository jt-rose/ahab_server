import { Updoot } from './entities/UPDOOT'
/* --------------------------------- imports -------------------------------- */

require('dotenv').config()

//import pg from 'pg'
//import joi from 'joi'

import 'reflect-metadata'
import { createConnection } from 'typeorm'
import { COOKIE_NAME, __PROD__ } from './constants'

import express from 'express'
import cors from 'cors'
import logger from 'morgan'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { HelloResolver } from './resolvers/hello'
import { PostResolver } from './resolvers/post'
import { UserResolver } from './resolvers/user'
import Redis from 'ioredis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import { MyContext } from './types'
import { Post } from './entities/POST'
import { User } from './entities/USER'
import path from 'path'

/* --------------------------- init main function --------------------------- */

const main = async () => {
  /* ------------------------- connect to TypeORM DB ------------------------ */

  const conn = await createConnection({
    type: 'postgres',
    database: 'ahab',
    username: 'postgres',
    password: process.env.LOCAL_PASSWORD,
    port: 8000,
    logging: true,
    synchronize: true,
    entities: [User, Post, Updoot],
    migrations: [path.join(__dirname, './migrations/*')],
  })

  await conn.runMigrations()

  /* --------------------------- initialize express --------------------------- */

  const app = express()

  const RedisStore = connectRedis(session)
  const redis = new Redis() // auto connect if running on localhost

  app.use(logger('dev'))
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  )
  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        sameSite: 'lax',
        secure: __PROD__, // disable for dev in localhost
      },
      secret: process.env.COOKIE_SECRET as string,
      resave: false,
      saveUninitialized: false,
    })
  )

  /* ---------------------------- initalize apollo ---------------------------- */

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  })

  apolloServer.applyMiddleware({ app, cors: false })

  const port = 5000
  app.listen(port, () => {
    console.log(`server listening on port ${port}`)
  })
}

/* ------------------------------- launch app ------------------------------- */

main().catch((err) => {
  console.log(err)
})
