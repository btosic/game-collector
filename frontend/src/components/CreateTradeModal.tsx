import { useState } from 'react';
import { type CollectionEntry, type PublicForTradeItem } from '../api/games.api';
import { tradesApi, type Trade } from '../api/trades.api';
import { GameThumbnail } from './GameThumbnail';

export function CreateTradeModal({
  forTradeItems,
  publicForTrade,
  currentUserId,
  onClose,
  onCreated,
}: {
  forTradeItems: CollectionEntry[];
  publicForTrade: PublicForTradeItem[];
  currentUserId: string;
  onClose: () => void;
  onCreated: (trade: Trade) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [offeredItem, setOfferedItem] = useState<CollectionEntry | null>(null);
  const [requestedItem, setRequestedItem] = useState<PublicForTradeItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherUsersItems = publicForTrade.filter((item) => item.user.id !== currentUserId);

  const groupedByUser = otherUsersItems.reduce<Record<string, { username: string; items: PublicForTradeItem[] }>>(
    (acc, item) => {
      const uid = item.user.id;
      if (!acc[uid]) acc[uid] = { username: item.user.username, items: [] };
      acc[uid].items.push(item);
      return acc;
    },
    {},
  );

  const handleSubmit = async () => {
    if (!offeredItem || !requestedItem) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await tradesApi.createTrade({
        receiverId: requestedItem.user.id,
        offeredGameId: offeredItem.id,
        offeredGameName: offeredItem.name,
        requestedGameId: requestedItem.id,
        requestedGameName: requestedItem.name,
      });
      onCreated(data);
    } catch {
      setError('Failed to send trade offer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">New Trade Offer</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Step {step} of 2 — {step === 1 ? 'Choose a game to offer' : 'Choose a game to request'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {step === 1 && (
            <div className="space-y-2">
              {forTradeItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setOfferedItem(item)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    offeredItem?.id === item.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <GameThumbnail thumbnail={item.thumbnail} name={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{item.name}</p>
                    {item.yearPublished && (
                      <p className="text-xs text-gray-500">{item.yearPublished}</p>
                    )}
                  </div>
                  {offeredItem?.id === item.id && (
                    <span className="text-indigo-400 text-sm flex-shrink-0">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              {Object.keys(groupedByUser).length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="font-medium text-sm">No other users have games for trade yet</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(groupedByUser).map(([uid, { username, items }]) => (
                    <div key={uid}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {username}
                      </p>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setRequestedItem(item)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                              requestedItem?.id === item.id
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'
                            }`}
                          >
                            <GameThumbnail thumbnail={item.thumbnail} name={item.name} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white font-medium truncate">{item.name}</p>
                              {item.yearPublished && (
                                <p className="text-xs text-gray-500">{item.yearPublished}</p>
                              )}
                            </div>
                            {requestedItem?.id === item.id && (
                              <span className="text-indigo-400 text-sm flex-shrink-0">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 space-y-3">
          {/* Trade summary */}
          {(offeredItem || requestedItem) && (
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/3 rounded-lg px-3 py-2">
              <span className={offeredItem ? 'text-white font-medium' : 'text-gray-600 italic'}>
                {offeredItem ? offeredItem.name : 'Your game'}
              </span>
              <span className="text-gray-600">↔</span>
              <span className={requestedItem ? 'text-white font-medium' : 'text-gray-600 italic'}>
                {requestedItem ? `${requestedItem.name} (${requestedItem.user.username})` : 'Their game'}
              </span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400" role="alert">{error}</p>
          )}

          <div className="flex gap-2 justify-between">
            <button
              onClick={() => step === 1 ? onClose() : setStep(1)}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            >
              {step === 1 ? 'Cancel' : '← Back'}
            </button>

            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!offeredItem}
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => void handleSubmit()}
                disabled={!requestedItem || submitting}
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Send Offer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
