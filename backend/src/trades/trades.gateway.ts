import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Trade } from './entities/trade.entity';

export interface TradeActivityPayload {
  id: string;
  status: string;
  requesterId: string;
  receiverId: string;
  offeredGameName: string;
  requestedGameName: string;
  timestamp: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/trades' })
export class TradesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TradesGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  /** Join a private trade negotiation room */
  @SubscribeMessage('join-trade-room')
  joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() tradeId: string,
  ): { event: string; data: string } {
    void client.join(`trade:${tradeId}`);
    this.logger.debug(`${client.id} joined trade room ${tradeId}`);
    return { event: 'joined', data: tradeId };
  }

  @SubscribeMessage('leave-trade-room')
  leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() tradeId: string,
  ): { event: string; data: string } {
    void client.leave(`trade:${tradeId}`);
    return { event: 'left', data: tradeId };
  }

  /** Send a chat message inside a trade room */
  @SubscribeMessage('trade-message')
  handleMessage(
    @MessageBody()
    payload: { tradeId: string; message: string; userId: string },
  ) {
    this.server.to(`trade:${payload.tradeId}`).emit('trade-message', {
      userId: payload.userId,
      message: payload.message,
      timestamp: new Date().toISOString(),
    });
  }

  /** Broadcast a trade event to ALL connected clients */
  broadcastActivity(trade: Trade) {
    const payload: TradeActivityPayload = {
      id: trade.id,
      status: trade.status,
      requesterId: trade.requesterId,
      receiverId: trade.receiverId,
      offeredGameName: trade.offeredGameName,
      requestedGameName: trade.requestedGameName,
      timestamp: new Date().toISOString(),
    };
    this.server.emit('trade-activity', payload);
  }

  /** Notify everyone in a specific trade room */
  notifyRoom(tradeId: string, event: string, data: unknown) {
    this.server.to(`trade:${tradeId}`).emit(event, data);
  }
}
