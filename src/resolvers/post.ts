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
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null // sort by newest
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit)
    const realLimitPlusOne = realLimit + 1 // grab one more to check remaining

    const replacements = cursor
      ? [realLimitPlusOne, new Date(parseInt(cursor))]
      : [realLimitPlusOne]

    const posts = await getConnection().query(
      `
    SELECT p.*, 
    json_build_object(
      'id', u.id,
      'username', u.username,
      
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
      ) creator
    FROM post p
    INNER JOIN public.user u ON u.id = p."creatorId"
    ${cursor ? 'WHERE p."createdAt" < $2' : ''}
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
