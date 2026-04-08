import { type Trade } from '../api/trades.api';
import { TradeStatusBadge } from './StatusBadge';

export function TradeCard({
  trade,
  currentUserId,
  onRespond,
  onCancel,
}: {
  trade: Trade;
  currentUserId: string;
  onRespond: (accept: boolean) => void;
  onCancel: () => void;
}) {
  const isRequester = trade.requesterId === currentUserId;

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm text-gray-400">
            {isRequester ? 'You offered' : 'Requested from you'}
          </p>
          <p className="font-medium text-white">{trade.offeredGameName}</p>
        </div>
        <span className="text-gray-600 mt-3">↔</span>
        <div className="text-right">
          <p className="text-sm text-gray-400">
            {isRequester ? 'For' : 'You give'}
          </p>
          <p className="font-medium text-white">{trade.requestedGameName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TradeStatusBadge status={trade.status} />
          <span className="text-xs text-gray-600">
            {isRequester
              ? `→ ${trade.receiver?.username ?? trade.receiverId}`
              : `← ${trade.requester?.username ?? trade.requesterId}`}
          </span>
        </div>

        {trade.status === 'PENDING' && (
          <div className="flex gap-2">
            {!isRequester && (
              <>
                <button
                  onClick={() => onRespond(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => onRespond(false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                >
                  Decline
                </button>
              </>
            )}
            {isRequester && (
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
