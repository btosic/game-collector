import type { GameStatus } from '../api/games.api';
import type { TradeStatus } from '../api/trades.api';

const GAME_STATUS_STYLES: Record<GameStatus, string> = {
  IN_COLLECTION: 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30',
  WISHLIST: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30',
  FOR_TRADE: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
};

const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  IN_COLLECTION: 'In Collection',
  WISHLIST: 'Wishlist',
  FOR_TRADE: 'For Trade',
};

const TRADE_STATUS_STYLES: Record<TradeStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300 ring-yellow-500/30',
  ACCEPTED: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  DECLINED: 'bg-red-500/20 text-red-300 ring-red-500/30',
  COMPLETED: 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-400 ring-gray-500/30',
};

export function GameStatusBadge({ status }: { status: GameStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${GAME_STATUS_STYLES[status]}`}
    >
      {GAME_STATUS_LABELS[status]}
    </span>
  );
}

export function TradeStatusBadge({ status }: { status: TradeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TRADE_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
