import { api } from './client';

export type TradeStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Trade {
  id: string;
  requesterId: string;
  receiverId: string;
  offeredGameId: string;
  offeredGameName: string;
  requestedGameId: string;
  requestedGameName: string;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; username: string };
  receiver?: { id: string; username: string };
}

export interface CreateTradePayload {
  receiverId: string;
  offeredGameId: string;
  offeredGameName: string;
  requestedGameId: string;
  requestedGameName: string;
}

export const tradesApi = {
  getActivity: (limit = 20) =>
    api.get<Trade[]>('/trades/activity', { params: { limit } }),

  getMyTrades: () => api.get<Trade[]>('/trades/mine'),

  createTrade: (payload: CreateTradePayload) =>
    api.post<Trade>('/trades', payload),

  respond: (id: string, accept: boolean) =>
    api.patch<Trade>(`/trades/${id}/respond`, { accept }),

  cancel: (id: string) => api.patch<Trade>(`/trades/${id}/cancel`),
};
