import { Resolver, Ctx, Arg, Mutation, Field, InputType } from 'type-graphql'
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

@Resolver()
export class UserResolver {
    @Mutation(() => User)
    async register(
        @Arg('options', () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { em }: MyContext
        ): Promise<User> {
            try {
                const hashedPassword = await argon2.hash(options.username)
                const user = em.create(User, { username: options.username, password: hashedPassword})
                await em.persistAndFlush(user)
                return user
            } catch(err) {
                return err
            }
    }
}