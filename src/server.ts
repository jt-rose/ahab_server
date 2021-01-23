/* --------------------------------- imports -------------------------------- */

require('dotenv').config()

//import pg from 'pg'
//import joi from 'joi'

import 'reflect-metadata' // necessary?
import { MikroORM } from '@mikro-orm/core'
import { __PROD__ } from './constants'
import mikroConfig from './mikro-orm.config'
//import { Post } from './entities/POST'

import express from 'express'
import cors from 'cors'
import logger from 'morgan'
import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { HelloResolver } from './resolvers/hello'
import { PostResolver } from './resolvers/post'
import { UserResolver } from './resolvers/user'
import redis from 'redis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import { MyContext } from './types'


/* --------------------------- init main function --------------------------- */

const main = async () => {
    
/* ------------------------- connect to Mikro-ORM DB ------------------------ */

    const orm = await MikroORM.init(mikroConfig)
    await orm.getMigrator().up()

    /*
    const post = orm.em.create(Post, { title: 'testing out orm'})
    orm.em.persistAndFlush(post)
    const currentPosts = await orm.em.find(Post, {title: 'testing out orm'})
    console.log(currentPosts)*/

    /*
    const client = new pg.Client({
        connectionString: ''
    })
    await client.connect()
    const x = await client.query('SELECT NOW()')
    console.log(x.rows[0])
    */

/* --------------------------- initialize express --------------------------- */

    const app = express()

    const RedisStore = connectRedis(session)
    const redisClient = redis.createClient() // auto connect if running on localhost
    
    app.use(logger('dev'))
    app.use(
        cors({ 
        origin: 'http://localhost:5000', 
        credentials: true}))
    app.use(
        session({
          name: 'qid',
          store: new RedisStore({ 
              client: redisClient,
              disableTouch: true,
             }),
             cookie: {
                 maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
                 httpOnly: true,
                 sameSite: 'lax',
                 secure: __PROD__ // disable for dev in localhost
             },
          secret: process.env.COOKIE_SECRET as string,
          resave: false,
          saveUninitialized: false
        })
      )

/* ---------------------------- initalize apollo ---------------------------- */

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false
        }),
        context: ({ req, res}): MyContext => ({ em: orm.em, req, res })
    })

    apolloServer.applyMiddleware({ app, cors: false })

    const port = 5000
    app.listen(port, () => {
        console.log(`server listening on port ${port}`)
    })

}

/* ------------------------------- launch app ------------------------------- */

main().catch( err => {
    console.log(err)
})