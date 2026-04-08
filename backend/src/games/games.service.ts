import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CollectionItem, GameStatus } from './entities/collection-item.entity';
import { BggService, BggSearchResult, BggGameDetail } from './bgg/bgg.service';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(CollectionItem)
    private readonly collectionRepo: Repository<CollectionItem>,
    private readonly bggService: BggService,
  ) {}

  search(query: string): Promise<BggSearchResult[]> {
    return this.bggService.search(query);
  }

  getGameDetails(id: string): Promise<BggGameDetail | null> {
    return this.bggService.getGame(id);
  }

  getCollection(userId: string): Promise<CollectionItem[]> {
    return this.collectionRepo.find({
      where: { userId },
      order: { addedAt: 'DESC' },
    });
  }

  async addToCollection(
    userId: string,
    bggGameId: string,
    status: GameStatus = GameStatus.IN_COLLECTION,
  ): Promise<CollectionItem> {
    const existing = await this.collectionRepo.findOne({
      where: { userId, bggGameId },
    });
    if (existing) throw new ConflictException('Game already in your collection');

    const game = await this.bggService.getGame(bggGameId);
    if (!game) throw new NotFoundException('Game not found on BoardGameGeek');

    const entry = this.collectionRepo.create({
      userId,
      bggGameId,
      name: game.name,
      thumbnail: game.thumbnail ?? undefined,
      yearPublished: game.yearPublished ?? undefined,
      status,
    });
    return this.collectionRepo.save(entry);
  }

  async updateStatus(
    userId: string,
    id: string,
    status: GameStatus,
  ): Promise<CollectionItem> {
    const entry = await this.collectionRepo.findOne({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Collection entry not found');
    entry.status = status;
    return this.collectionRepo.save(entry);
  }

  getPublicForTrade(currentUserId: string): Promise<CollectionItem[]> {
    return this.collectionRepo.find({
      where: { status: GameStatus.FOR_TRADE, userId: Not(currentUserId) },
      relations: ['user'],
      order: { addedAt: 'DESC' },
    });
  }

  async removeFromCollection(userId: string, id: string): Promise<void> {
    const entry = await this.collectionRepo.findOne({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Collection entry not found');
    await this.collectionRepo.remove(entry);
  }
}
