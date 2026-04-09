import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1775749038082 implements MigrationInterface {
    name = 'InitialSchema1775749038082'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."game_collections_status_enum" AS ENUM('IN_COLLECTION', 'WISHLIST', 'FOR_TRADE')`);
        await queryRunner.query(`CREATE TABLE "game_collections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "bggGameId" character varying NOT NULL, "name" character varying NOT NULL, "thumbnail" character varying, "yearPublished" character varying, "status" "public"."game_collections_status_enum" NOT NULL DEFAULT 'IN_COLLECTION', "addedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_425cc74bff1a8705cc8ca857b0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_74dd9f3d39912b2e3fba8d3d91" ON "game_collections" ("userId", "bggGameId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."trades_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "trades" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requesterId" uuid NOT NULL, "receiverId" uuid NOT NULL, "offeredGameId" character varying NOT NULL, "offeredGameName" character varying NOT NULL, "requestedGameId" character varying NOT NULL, "requestedGameName" character varying NOT NULL, "status" "public"."trades_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c6d7c36a837411ba5194dc58595" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "game_collections" ADD CONSTRAINT "FK_4cd3ac63c34c2dee6ac2af5ea63" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trades" ADD CONSTRAINT "FK_ebba4c55b8c6cb19b086cd04965" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trades" ADD CONSTRAINT "FK_6fc0587a1a64f8b88f9b198a8d7" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" DROP CONSTRAINT "FK_6fc0587a1a64f8b88f9b198a8d7"`);
        await queryRunner.query(`ALTER TABLE "trades" DROP CONSTRAINT "FK_ebba4c55b8c6cb19b086cd04965"`);
        await queryRunner.query(`ALTER TABLE "game_collections" DROP CONSTRAINT "FK_4cd3ac63c34c2dee6ac2af5ea63"`);
        await queryRunner.query(`DROP TABLE "trades"`);
        await queryRunner.query(`DROP TYPE "public"."trades_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_74dd9f3d39912b2e3fba8d3d91"`);
        await queryRunner.query(`DROP TABLE "game_collections"`);
        await queryRunner.query(`DROP TYPE "public"."game_collections_status_enum"`);
    }

}
