import { User } from '../entities/USER'
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
  Field,
  ObjectType,
} from 'type-graphql'
import { Post } from '../entities/POST'
import { getConnection } from 'typeorm'
import { Updoot } from '../entities/UPDOOT'

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[]

  @Field()
  hasMore: boolean
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50)
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId)
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext
  ) {
    if (!req.session.userId) return null
    const updoot = await updootLoader.load({
      postId: post.id,
      userId: req.session.userId,
    })
    return updoot ? updoot.value : null
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1
    const realValue = isUpdoot ? 1 : -1
    const { userId } = req.session

    // check if entry already in db
    const updoot = await Updoot.findOne({
      where: {
        postId,
        userId,
      },
    })

    // the user has voted on this post before
    // voted before, now changing vote
    if (updoot && updoot.value !== realValue) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        UPDATE updoot
        SET value = $1
        WHERE "postId" = $2 AND "userId" = $3
        `,
          [realValue, postId, userId]
        )

        await tm.query(
          `
        UPDATE post
    SET points = points + $1
    WHERE id = $2
        `,
          [realValue * 2, postId]
        )
      })

      // never voted before
    } else if (!updoot) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
        INSERT INTO updoot ("userId", "postId", value)
    values ($1, $2, $3)
        `,
          [userId, postId, realValue]
        )

        await tm.query(
          `
        UPDATE post
    SET points = points + $1
    WHERE id = $2
        `,
          [realValue, postId]
        )
      })
    }
    return true
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
    //@Ctx() { req }: MyContext // sort by newest
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit)
    const realLimitPlusOne = realLimit + 1 // grab one more to check remaining

    const replacements: (number | Date)[] = [realLimitPlusOne]
    //const { userId } = req.session

    if (cursor) {
      const formattedCursor = new Date(parseInt(cursor))
      replacements.push(formattedCursor)
    }

    const posts = await getConnection().query(
      `
    SELECT p.*
    FROM post p
    ${cursor ? `WHERE p."createdAt" < $2` : ''}
    ORDER BY p."createdAt" DESC
    LIMIT $1
    `,
      replacements
    )

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    }
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
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
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id AND "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning('*')
      .execute()

    return result.raw[0]
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<Boolean> {
    const { userId } = req.session

    // non-cascade approach
    /*
    const post = await Post.findOne(id)
    if (!post) return false
    if (post.creatorId !== userId) {
      throw new Error('not authorized')
    }

    await Updoot.delete({ postId: id})
    */
    await Post.delete({ id, creatorId: userId })
    return true
  }
}
