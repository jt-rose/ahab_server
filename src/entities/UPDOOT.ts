import { Entity, ManyToOne, BaseEntity, PrimaryColumn, Column } from 'typeorm'
import { User } from './USER'
import { Post } from './POST'

// set up join between user and posts
// for many to many relationship

@Entity()
export class Updoot extends BaseEntity {
  @Column({ type: 'int' })
  value: number

  @PrimaryColumn()
  userId: number

  @ManyToOne(() => User, (user) => user.updoots)
  user: User

  @PrimaryColumn()
  postId: number

  @ManyToOne(() => Post, (post) => post.updoots, {
    onDelete: 'CASCADE',
  })
  post: Post
}
