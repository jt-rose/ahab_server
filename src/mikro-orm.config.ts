import { MikroORM } from '@mikro-orm/core'
import { Post } from './entities/POST'
import { __PROD__ } from './constants'
import path from 'path'

export default {
    migrations: {
        path: path.join(__dirname, './migrations'),
        pattern: /^[\w-]+\d+\.[tj]s$/,
    },
    entities: [Post],
    dbName: process.env.LOCAL_NAME,
    type: 'postgresql',
    debug: !__PROD__,
    user: process.env.LOCAL_USER,
    password: process.env.LOCAL_PASSWORD,
    port: process.env.LOCAL_PORT
} as Parameters<typeof MikroORM.init>[0]
