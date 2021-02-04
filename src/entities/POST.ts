import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BaseEntity,
  OneToMany,
} from 'typeorm'
import { Field, Int, ObjectType } from 'type-graphql'
import { User } from './USER'
import { Updoot } from './UPDOOT'

@ObjectType()
@Entity()
export class Post extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number

  @Field()
  @Column()
  title!: string

  @Field()
  @Column()
  text!: string

  @Field()
  @Column({ type: 'int', default: 0 })
  points!: number

  @Field()
  @Column()
  creatorId: number

  //set up foreign key to user
  // connect to entity, then connect to entity property
  @Field(() => User)
  @ManyToOne(() => User, (user) => user.posts)
  creator: User

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => Updoot, (updoot) => updoot.post)
  updoots: Updoot[]

  @Field(() => Int, { nullable: true })
  voteStatus: number | null // 1, -1, or null
}
