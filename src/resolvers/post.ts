import { isAuth } from '../middleware/isAuth'
import { MyContext } from '../types'
import {
  Resolver,
  Query,
  Arg,
  Mutation,
  Ctx,
  UseMiddleware,
  Int,
  FieldResolver,
  Root,
} from 'type-graphql'
import { Post } from '../entities/POST'
import { getConnection } from 'typeorm'

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50)
  }

  @Query(() => [Post])
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null // sort by newest
  ): Promise<Post[]> {
    const realLimit = Math.min(50, limit)
    const queryBuilder = getConnection()
      .getRepository(Post)
      .createQueryBuilder('p')
      .orderBy('"createdAt"', 'DESC') //postgres will make lowercase unless "" wrapped in '
      .take(realLimit)

    if (cursor) {
      return queryBuilder
        .where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) })
        .getMany()
    } else {
      return queryBuilder.getMany()
    }
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id') id: number): Promise<Post | undefined> {
    return Post.findOne(id)
  }

  //need to be logged in
  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    // 2 seperate sql queries
    const creatorId = req.session.userId
    return Post.create({ title, text, creatorId }).save()
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg('id') id: number,
    @Arg('title') title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id)
    if (!post) {
      return null
    }
    if (typeof title !== 'undefined') {
      await Post.update({ id }, { title })
    }
    return post // returning old post?
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(@Arg('id') id: number): Promise<Boolean> {
    await Post.delete(id)
    return true
  }
}
