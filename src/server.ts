/* --------------------------------- imports -------------------------------- */

require('dotenv').config()

//import pg from 'pg'
//import joi from 'joi'

import { MikroORM } from '@mikro-orm/core'
import { __PROD__ } from './constants'
import mikroConfig from './mikro-orm.config'
import { Post } from './entities/POST'

import express from 'express'


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
    const port = 5000

    app.listen(port, () => {
        console.log(`server listening on port ${port}`)
    })


}

main().catch( err => {
    console.log(err)
})