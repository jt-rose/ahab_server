import { Resolver, Query, Ctx } from 'type-graphql'
import { Post } from '../entities/POST'
import { MyContext } from '../types'

@Resolver()
export class PostResolver {
    @Query(() => [Post])
    posts(
        @Ctx() ctx: MyContext
    ): Promise<Post[]> {
        return ctx.em.find(Post, {}) // no await handling needed?
    }
}