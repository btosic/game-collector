import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Not } from 'typeorm';
import { GamesService } from './games.service';
import { CollectionItem, GameStatus } from './entities/collection-item.entity';
import { BggService } from './bgg/bgg.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const mockBggService = () => ({
  search: jest.fn(),
  getGame: jest.fn(),
});

describe('GamesService', () => {
  let service: GamesService;
  let repo: ReturnType<typeof mockRepo>;
  let bgg: ReturnType<typeof mockBggService>;

  const userId = 'user-uuid';
  const itemId = 'item-uuid';
  const bggGameId = '174430';

  const mockItem: Partial<CollectionItem> = {
    id: itemId,
    userId,
    bggGameId,
    name: 'Gloomhaven',
    status: GameStatus.IN_COLLECTION,
  };

  const mockBggGame = {
    id: bggGameId,
    name: 'Gloomhaven',
    thumbnail: 'https://example.com/thumb.jpg',
    yearPublished: '2017',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: getRepositoryToken(CollectionItem), useFactory: mockRepo },
        { provide: BggService, useFactory: mockBggService },
      ],
    }).compile();

    service = module.get(GamesService);
    repo = module.get(getRepositoryToken(CollectionItem));
    bgg = module.get(BggService);
  });

  describe('search', () => {
    it('delegates to BggService', async () => {
      const results = [{ id: bggGameId, name: 'Gloomhaven', yearPublished: '2017' }];
      bgg.search.mockResolvedValue(results);

      const result = await service.search('Gloomhaven');

      expect(bgg.search).toHaveBeenCalledWith('Gloomhaven');
      expect(result).toEqual(results);
    });
  });

  describe('getCollection', () => {
    it("returns the user's collection ordered by addedAt descending", async () => {
      repo.find.mockResolvedValue([mockItem]);

      const result = await service.getCollection(userId);

      expect(result).toEqual([mockItem]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId },
        order: { addedAt: 'DESC' },
      });
    });
  });

  describe('addToCollection', () => {
    it('adds a game and returns the new collection entry', async () => {
      repo.findOne.mockResolvedValue(null);
      bgg.getGame.mockResolvedValue(mockBggGame);
      repo.create.mockReturnValue(mockItem);
      repo.save.mockResolvedValue(mockItem);

      const result = await service.addToCollection(userId, bggGameId);

      expect(bgg.getGame).toHaveBeenCalledWith(bggGameId);
      expect(repo.save).toHaveBeenCalledWith(mockItem);
      expect(result).toEqual(mockItem);
    });

    it('defaults status to IN_COLLECTION when not specified', async () => {
      repo.findOne.mockResolvedValue(null);
      bgg.getGame.mockResolvedValue(mockBggGame);
      repo.create.mockReturnValue(mockItem);
      repo.save.mockResolvedValue(mockItem);

      await service.addToCollection(userId, bggGameId);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: GameStatus.IN_COLLECTION }),
      );
    });

    it('throws ConflictException when the game is already in the collection', async () => {
      repo.findOne.mockResolvedValue(mockItem);

      await expect(service.addToCollection(userId, bggGameId)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the game does not exist on BoardGameGeek', async () => {
      repo.findOne.mockResolvedValue(null);
      bgg.getGame.mockResolvedValue(null);

      await expect(service.addToCollection(userId, bggGameId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates the status and returns the updated entry', async () => {
      repo.findOne.mockResolvedValue({ ...mockItem });
      const updated = { ...mockItem, status: GameStatus.FOR_TRADE };
      repo.save.mockResolvedValue(updated);

      const result = await service.updateStatus(userId, itemId, GameStatus.FOR_TRADE);

      expect(result.status).toBe(GameStatus.FOR_TRADE);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when the entry does not belong to the user', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(userId, itemId, GameStatus.FOR_TRADE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeFromCollection', () => {
    it('removes the collection entry', async () => {
      repo.findOne.mockResolvedValue(mockItem);
      repo.remove.mockResolvedValue(undefined);

      await service.removeFromCollection(userId, itemId);

      expect(repo.remove).toHaveBeenCalledWith(mockItem);
    });

    it('throws NotFoundException when the entry does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.removeFromCollection(userId, itemId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPublicForTrade', () => {
    it("returns other users' FOR_TRADE items excluding the current user", async () => {
      repo.find.mockResolvedValue([]);

      await service.getPublicForTrade(userId);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: GameStatus.FOR_TRADE,
            userId: Not(userId),
          }),
        }),
      );
    });
  });
});
