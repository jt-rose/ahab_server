import { Entity, PrimaryKey, Property} from '@mikro-orm/core'

@Entity()
export class Post {

  @PrimaryKey()
  id!: number;

  @Property({ type: 'date', defaultRaw: 'NOW()'})
  createdAt = new Date();

  @Property({ type: 'date', defaultRaw: 'NOW()', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'text'})
  title!: string;
}