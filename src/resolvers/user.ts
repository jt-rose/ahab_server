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
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants'
import { validateRegister } from '../utils/validateRegister'
import { UserInput } from './UserInput'
import { sendEmail } from '../utils/sendEmail'
import { v4 } from 'uuid'
import { getConnection } from 'typeorm'

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
  fetchUser(@Ctx() { req }: MyContext) {
    // if not logged in
    if (!req.session.userId) return null

    return User.findOne(req.session.userId)
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options', () => UserInput) options: UserInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options)
    if (errors) return { errors }

    const hashedPassword = await argon2.hash(options.username)
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: options.username,
          password: hashedPassword,
          email: options.email,
        })
        .returning('*')
        .execute()

      // set user cookie
      const user = result.raw[0]
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
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    try {
      const searchParam = usernameOrEmail.includes('@')
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
      const user = await User.findOne({ where: searchParam })
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
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } })
    if (!user) {
      // no email in database - don't tell user
      return true
    }

    const token = v4()
    console.log('key: ' + FORGET_PASSWORD_PREFIX + token)
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      'ex',
      1000 * 60 * 60
    )
    const resetLink = `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    await sendEmail(email, resetLink).catch((err) => console.error(err))

    return true
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, req }: MyContext
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
    const key = FORGET_PASSWORD_PREFIX + token
    console.log('key: ' + key)
    const redisId = await redis.get(key)
    if (!redisId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'Error: token expired',
          },
        ],
      }
    }

    const userId = parseInt(redisId)
    const user = await User.findOne(userId)
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
    user.password = hashedPassword
    /*const updatedUser = {
      ...user,
      password: hashedPassword,
    }*/

    // note: functional pattern of obj destructuring caused error
    // with em.persistAndFlush
    await User.update({ id: userId }, { password: hashedPassword })

    // delete redis change-password session
    await redis.del(key)

    // login after changing password
    req.session.userId = user.id

    return {
      user: user,
    }
  }
}
