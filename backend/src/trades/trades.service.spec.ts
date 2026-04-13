import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradesService } from './trades.service';
import { Trade, TradeStatus } from './entities/trade.entity';
import { TradesGateway } from './trades.gateway';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockGateway = () => ({
  broadcastActivity: jest.fn(),
  notifyRoom: jest.fn(),
});

describe('TradesService', () => {
  let service: TradesService;
  let repo: ReturnType<typeof mockRepo>;
  let gateway: ReturnType<typeof mockGateway>;

  const requesterId = 'requester-uuid';
  const receiverId = 'receiver-uuid';
  const tradeId = 'trade-uuid';

  const pendingTrade: Partial<Trade> = {
    id: tradeId,
    requesterId,
    receiverId,
    offeredGameId: 'game-1',
    offeredGameName: 'Gloomhaven',
    requestedGameId: 'game-2',
    requestedGameName: 'Pandemic',
    status: TradeStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradesService,
        { provide: getRepositoryToken(Trade), useFactory: mockRepo },
        { provide: TradesGateway, useFactory: mockGateway },
      ],
    }).compile();

    service = module.get(TradesService);
    repo = module.get(getRepositoryToken(Trade));
    gateway = module.get(TradesGateway);
  });

  describe('create', () => {
    it('persists the trade and broadcasts the activity', async () => {
      repo.create.mockReturnValue(pendingTrade);
      repo.save.mockResolvedValue(pendingTrade);

      const result = await service.create(
        requesterId,
        receiverId,
        'game-1',
        'Gloomhaven',
        'game-2',
        'Pandemic',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ requesterId, receiverId, status: TradeStatus.PENDING }),
      );
      expect(repo.save).toHaveBeenCalledWith(pendingTrade);
      expect(gateway.broadcastActivity).toHaveBeenCalledWith(pendingTrade);
      expect(result).toEqual(pendingTrade);
    });
  });

  describe('respond', () => {
    it('accepts a pending trade and notifies the room', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade });
      const accepted = { ...pendingTrade, status: TradeStatus.ACCEPTED };
      repo.save.mockResolvedValue(accepted);

      const result = await service.respond(receiverId, tradeId, true);

      expect(result.status).toBe(TradeStatus.ACCEPTED);
      expect(gateway.broadcastActivity).toHaveBeenCalledWith(accepted);
      expect(gateway.notifyRoom).toHaveBeenCalledWith(tradeId, 'trade-updated', {
        status: TradeStatus.ACCEPTED,
      });
    });

    it('declines a pending trade', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade });
      const declined = { ...pendingTrade, status: TradeStatus.DECLINED };
      repo.save.mockResolvedValue(declined);

      const result = await service.respond(receiverId, tradeId, false);

      expect(result.status).toBe(TradeStatus.DECLINED);
    });

    it('throws NotFoundException when the trade does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.respond(receiverId, tradeId, true)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the receiver', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade });

      await expect(service.respond('other-user', tradeId, true)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when the trade is no longer pending', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade, status: TradeStatus.ACCEPTED });

      await expect(service.respond(receiverId, tradeId, true)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('cancels a pending trade and broadcasts the activity', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade });
      const cancelled = { ...pendingTrade, status: TradeStatus.CANCELLED };
      repo.save.mockResolvedValue(cancelled);

      const result = await service.cancel(requesterId, tradeId);

      expect(result.status).toBe(TradeStatus.CANCELLED);
      expect(gateway.broadcastActivity).toHaveBeenCalledWith(cancelled);
    });

    it('throws NotFoundException when the trade does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.cancel(requesterId, tradeId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the requester', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade });

      await expect(service.cancel('other-user', tradeId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the trade is not pending', async () => {
      repo.findOne.mockResolvedValue({ ...pendingTrade, status: TradeStatus.ACCEPTED });

      await expect(service.cancel(requesterId, tradeId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyTrades', () => {
    it('queries trades where user is requester or receiver', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([pendingTrade]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getMyTrades(requesterId);

      expect(qb.where).toHaveBeenCalledWith(
        't.requesterId = :uid OR t.receiverId = :uid',
        { uid: requesterId },
      );
      expect(result).toEqual([pendingTrade]);
    });
  });
});
