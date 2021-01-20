import { Migration } from '@mikro-orm/migrations';

export class Migration20210120183232 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "user" ("id" serial primary key, "created_at" timestamptz(0) not null default NOW(), "updated_at" timestamptz(0) not null default NOW(), "username" text not null, "password" text not null);');
    this.addSql('alter table "user" add constraint "user_username_unique" unique ("username");');
  }

}
