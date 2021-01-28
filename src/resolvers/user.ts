import {
  Resolver,
  Ctx,
  Arg,
  Mutation,
  Field,
  ObjectType,
  Query,
} from 'type-graphql'
import { User } from '../entities/USER'
import { MyContext } from '../types'
import argon2 from 'argon2'
//import { EntityManager } from '@mikro-orm/postgresql'
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants'
import { validateRegister } from '../utils/validateRegister'
import { UserInput } from './UserInput'
import { sendEmail } from '../utils/sendEmail'
import { v4 } from 'uuid'

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[]

  @Field(() => User, { nullable: true })
  user?: User
}

@ObjectType()
class FieldError {
  @Field()
  field: string

  @Field()
  message: string
}

/* ------------------------------ User resolver ----------------------------- */

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async fetchUser(@Ctx() { req, em }: MyContext): Promise<User | null> {
    // if not logged in
    if (!req.session.userId) return null

    const user = await em.findOne(User, { id: req.session.userId })
    return user
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options', () => UserInput) options: UserInput,
    @Ctx() { req, em }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options)
    if (errors) return { errors }

    const hashedPassword = await argon2.hash(options.username)
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
      email: options.email,
    })
    try {
      // unused mikro-orm call with query builder
      /*
      const [user] = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
        username: options.username,
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*')
      */
      await em.persistAndFlush(user)

      // set user cookie
      req.session.userId = user.id
      return { user }
    } catch (err) {
      if (err.code === '23505')
        return {
          errors: [
            {
              field: 'usernameOrEmail',
              message: 'username already registered',
            },
          ],
        }
      return {
        errors: [
          {
            field: 'unknown',
            message: err.message,
          },
        ],
      }
    }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    try {
      const searchParam = usernameOrEmail.includes('@')
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
      const user = await em.findOne(User, searchParam) //.toLowercase()
      if (!user)
        return {
          errors: [
            {
              field: 'usernameOrEmail',
              message: 'no such user',
            },
          ],
        }

      const validPassword = await argon2.verify(user.password, password)
      if (!validPassword)
        return {
          errors: [
            {
              field: 'password',
              message: 'Error: incorrect username/ password',
            },
          ],
        }

      req.session.userId = user.id

      return {
        user,
      }
    } catch (err) {
      return err
    }
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME)
        if (err) {
          console.log(err)
          resolve(false)
          return
        }

        resolve(true)
      })
    )
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email') email: string,
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { email })
    if (!user) {
      // no email in database - don't tell user
      return true
    }
    const token = v4()
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      'ex',
      1000 * 60 * 60
    )
    const resetLink = `<a href="http://localhost:3000/change-password/${token}}">reset password</a>`
    await sendEmail(email, resetLink).catch((err) => console.error(err))

    return true
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, em, req }: MyContext
  ): Promise<UserResponse> {
    // validate new password
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: 'password too short',
          },
        ],
      }
    }

    const userId = await redis.get(FORGET_PASSWORD_PREFIX + token)
    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'Error: token expired',
          },
        ],
      }
    }

    const user = await em.findOne(User, { id: parseInt(userId) })
    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'Error: user no longer exists',
          },
        ],
      }
    }

    const hashedPassword = await argon2.hash(newPassword)
    const updatedUser = {
      ...user,
      password: hashedPassword,
    }
    await em.persistAndFlush(updatedUser)

    // login after changing password
    req.session.userId = user.id

    return {
      user: updatedUser,
    }
  }
}
