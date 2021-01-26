import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import { Field, Int, ObjectType } from 'type-graphql'

@ObjectType()
@Entity()
export class User {
  @Field(() => Int)
  @PrimaryKey()
  id!: number

  @Field(() => String)
  @Property({ type: 'date', defaultRaw: 'NOW()' })
  createdAt = new Date()

  @Field(() => String)
  @Property({ type: 'date', defaultRaw: 'NOW()', onUpdate: () => new Date() })
  updatedAt = new Date()

  @Field(() => String)
  @Property({ type: 'text', unique: true })
  username!: string

  @Field(() => String)
  @Property({ type: 'text', unique: true })
  email!: string

  // remove @Field decorator to make inaccessible
  @Property({ type: 'text' })
  password!: string
}
