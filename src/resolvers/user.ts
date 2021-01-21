import { Resolver, Ctx, Arg, Mutation, Field, InputType, ObjectType } from 'type-graphql'
import { User } from '../entities/USER'
import { MyContext } from '../types'
import argon2 from 'argon2'

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@ObjectType()// replace with union
class UserResponse {
    @Field(() => [FieldError], { nullable: true})
    errors?: FieldError[]

    @Field(() => User, { nullable: true})
    user?: User
}

@ObjectType()
class FieldError {
    @Field()
    field: string

    @Field()
    message: string
}

@Resolver()
export class UserResolver {
    @Mutation(() => UserResponse)
    async register(
        @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
        ): Promise<UserResponse> {
            if (options.username.length <= 2 ) {
                return {
                    errors: [
                        {
                            field: 'username',
                            message: 'username is too short'
                        }
                    ]
                }
            }

            if (options.password.length <= 2) {
                return {
                    errors: [
                        {
                            field: 'password',
                            message: 'password too short'
                        }
                    ]
                }
            }

            try {
                const hashedPassword = await argon2.hash(options.username)
                const user = em.create(User, { username: options.username, password: hashedPassword})
                await em.persistAndFlush(user)
                return  { user }
            } catch(err) {
                if (err.code === '23505') return {
                    errors: [
                        {
                            field: 'username',
                            message: 'username already registered'
                        }
                    ]
                }
                return {
                    errors: [
                        {
                            field: 'unknown',
                            message: err.message
                        }
                    ]
                }
            }
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
        ): Promise<UserResponse> {
            try {
                const user = await em.findOne(User, {username: options.username})//.toLowercase()
                if (!user) return {
                    errors: [
                        {
                            field: 'username',
                            message: 'no such user'
                        }
                    ]
                }

                const validPassword = await argon2.verify(user.password, options.password)
                if (!validPassword) return {
                    errors: [
                        {
                            field: 'password',
                            message: 'Error: incorrect username/ password'
                        }
                    ]
                }

                return {
                    user
                }
            } catch(err) {
                return err
            }
    }
}