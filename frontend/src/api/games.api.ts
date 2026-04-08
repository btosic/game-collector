import { api } from './client';

export type GameStatus = 'IN_COLLECTION' | 'WISHLIST' | 'FOR_TRADE';

export interface BggSearchResult {
  id: string;
  name: string;
  yearPublished: string | null;
}

export interface BggGameDetail extends BggSearchResult {
  thumbnail: string | null;
  image: string | null;
  description: string | null;
  minPlayers: string | null;
  maxPlayers: string | null;
  rating: string | null;
}

export interface CollectionEntry {
  id: string;
  bggGameId: string;
  name: string;
  thumbnail: string | null;
  yearPublished: string | null;
  status: GameStatus;
  addedAt: string;
}

export interface PublicForTradeItem extends CollectionEntry {
  user: { id: string; username: string };
}

export const gamesApi = {
  search: (q: string) =>
    api.get<BggSearchResult[]>('/games/search', { params: { q } }),

  getGame: (id: string) => api.get<BggGameDetail>(`/games/bgg/${id}`),

  getCollection: () => api.get<CollectionEntry[]>('/games/collection'),

  getPublicForTrade: () => api.get<PublicForTradeItem[]>('/games/for-trade'),

  addToCollection: (bggGameId: string, status?: GameStatus) =>
    api.post<CollectionEntry>('/games/collection', { bggGameId, status }),

  updateStatus: (id: string, status: GameStatus) =>
    api.patch<CollectionEntry>(`/games/collection/${id}`, { status }),

  removeFromCollection: (id: string) =>
    api.delete(`/games/collection/${id}`),
};
