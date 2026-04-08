import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum GameStatus {
  IN_COLLECTION = 'IN_COLLECTION',
  WISHLIST = 'WISHLIST',
  FOR_TRADE = 'FOR_TRADE',
}

@Entity('game_collections')
@Index(['userId', 'bggGameId'], { unique: true })
export class CollectionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.gameCollections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  bggGameId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ nullable: true })
  yearPublished: string;

  @Column({ type: 'enum', enum: GameStatus, default: GameStatus.IN_COLLECTION })
  status: GameStatus;

  @CreateDateColumn()
  addedAt: Date;
}
