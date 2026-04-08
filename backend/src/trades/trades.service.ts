import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, TradeStatus } from './entities/trade.entity';
import { TradesGateway } from './trades.gateway';

@Injectable()
export class TradesService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradesRepo: Repository<Trade>,
    private readonly gateway: TradesGateway,
  ) {}

  getRecentActivity(limit = 20): Promise<Trade[]> {
    return this.tradesRepo.find({
      order: { updatedAt: 'DESC' },
      take: limit,
      relations: ['requester', 'receiver'],
    });
  }

  getMyTrades(userId: string): Promise<Trade[]> {
    return this.tradesRepo
      .createQueryBuilder('t')
      .where('t.requesterId = :uid OR t.receiverId = :uid', { uid: userId })
      .leftJoinAndSelect('t.requester', 'requester')
      .leftJoinAndSelect('t.receiver', 'receiver')
      .orderBy('t.updatedAt', 'DESC')
      .getMany();
  }

  async create(
    requesterId: string,
    receiverId: string,
    offeredGameId: string,
    offeredGameName: string,
    requestedGameId: string,
    requestedGameName: string,
  ): Promise<Trade> {
    const trade = this.tradesRepo.create({
      requesterId,
      receiverId,
      offeredGameId,
      offeredGameName,
      requestedGameId,
      requestedGameName,
      status: TradeStatus.PENDING,
    });
    const saved = await this.tradesRepo.save(trade);
    this.gateway.broadcastActivity(saved);
    return saved;
  }

  async respond(userId: string, tradeId: string, accept: boolean): Promise<Trade> {
    const trade = await this.tradesRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.receiverId !== userId)
      throw new ForbiddenException('Only the receiver can respond');
    if (trade.status !== TradeStatus.PENDING)
      throw new ForbiddenException('Trade is no longer pending');

    trade.status = accept ? TradeStatus.ACCEPTED : TradeStatus.DECLINED;
    const updated = await this.tradesRepo.save(trade);

    this.gateway.broadcastActivity(updated);
    this.gateway.notifyRoom(tradeId, 'trade-updated', { status: updated.status });
    return updated;
  }

  async cancel(userId: string, tradeId: string): Promise<Trade> {
    const trade = await this.tradesRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.requesterId !== userId)
      throw new ForbiddenException('Only the requester can cancel');
    if (trade.status !== TradeStatus.PENDING)
      throw new ForbiddenException('Only pending trades can be cancelled');

    trade.status = TradeStatus.CANCELLED;
    const updated = await this.tradesRepo.save(trade);
    this.gateway.broadcastActivity(updated);
    return updated;
  }
}
