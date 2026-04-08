import { useCallback, useEffect, useRef, useState } from 'react';
import { gamesApi, type CollectionEntry, type PublicForTradeItem } from '../api/games.api';
import { tradesApi, type Trade, type TradeStatus } from '../api/trades.api';
import { CreateTradeModal } from '../components/CreateTradeModal';
import { GameThumbnail } from '../components/GameThumbnail';
import { TradeCard } from '../components/TradeCard';
import { TradeStatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

interface ActivityEvent {
  id: string;
  requesterId: string;
  receiverId: string;
  offeredGameName: string;
  requestedGameName: string;
  status: TradeStatus;
  timestamp: string;
}

export default function TradesPage() {
  const { user } = useAuth();
  const [myTrades, setMyTrades] = useState<Trade[]>([]);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [publicForTrade, setPublicForTrade] = useState<PublicForTradeItem[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);
  const forTradeItems = collection.filter((entry) => entry.status === 'FOR_TRADE');

  const handleSocketEvent = useCallback((event: string, data: unknown) => {
    if (event === 'trade-activity') {
      const activityData = data as ActivityEvent;
      setActivity((prev) => [activityData, ...prev].slice(0, 50));
      if (activityRef.current) {
        activityRef.current.scrollTop = 0;
      }
      if (user && (activityData.requesterId === user.id || activityData.receiverId === user.id)) {
        void tradesApi.getMyTrades().then(({ data: trades }) => setMyTrades(trades));
      }
    }
    if (event === 'trade-updated') {
      void tradesApi.getMyTrades().then(({ data: trades }) => setMyTrades(trades));
    }
  }, [user]);

  useSocket('/trades', handleSocketEvent);

  useEffect(() => {
    Promise.allSettled([
      tradesApi.getMyTrades(),
      tradesApi.getActivity(30),
      gamesApi.getCollection(),
      gamesApi.getPublicForTrade(),
    ])
      .then(([tradesResult, activityResult, collectionResult, publicForTradeResult]) => {
        if (tradesResult.status === 'fulfilled') {
          setMyTrades(tradesResult.value.data);
        }

        if (activityResult.status === 'fulfilled') {
          setActivity(
            activityResult.value.data.map((t) => ({
              id: t.id,
              requesterId: t.requesterId,
              receiverId: t.receiverId,
              offeredGameName: t.offeredGameName,
              requestedGameName: t.requestedGameName,
              status: t.status,
              timestamp: t.updatedAt,
            })),
          );
        }

        if (collectionResult.status === 'fulfilled') {
          setCollection(collectionResult.value.data);
        }

        if (publicForTradeResult.status === 'fulfilled') {
          setPublicForTrade(publicForTradeResult.value.data);
        }

        if (
          tradesResult.status === 'rejected' ||
          activityResult.status === 'rejected' ||
          collectionResult.status === 'rejected'
        ) {
          setLoadError('Some trade data could not be loaded. Showing available results.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const respond = async (id: string, accept: boolean) => {
    const { data } = await tradesApi.respond(id, accept);
    setMyTrades((prev) => prev.map((t) => (t.id === id ? data : t)));
  };

  const cancel = async (id: string) => {
    const { data } = await tradesApi.cancel(id);
    setMyTrades((prev) => prev.map((t) => (t.id === id ? data : t)));
  };

  const handleTradeCreated = (trade: Trade) => {
    setMyTrades((prev) => [trade, ...prev]);
    setShowCreateModal(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Trade Hub</h1>
        <p className="text-gray-500 text-sm mt-1">
          Negotiate real-time board game trades with other collectors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Live Activity Feed */}
        <aside className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Live Activity
            </h2>
          </div>

          <div
            ref={activityRef}
            className="h-[500px] overflow-y-auto space-y-2 rounded-xl bg-white/3 border border-white/10 p-3"
          >
            {activity.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">
                No recent activity yet
              </p>
            ) : (
              activity.map((a, i) => (
                <div
                  key={`${a.id}-${i}`}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <TradeStatusBadge status={a.status} />
                    <span className="text-gray-600">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-300">
                    <span className="text-white">{a.offeredGameName}</span>
                    <span className="text-gray-500 mx-1">↔</span>
                    <span className="text-white">{a.requestedGameName}</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* My Trades */}
        <section className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Available for Trade
          </h2>

          <div className="mb-6 rounded-xl bg-white/3 border border-white/10 p-4">
            {forTradeItems.length === 0 ? (
              <p className="text-sm text-gray-500">
                You do not have any games marked as "For Trade" yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {forTradeItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <GameThumbnail thumbnail={item.thumbnail} name={item.name} />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{item.name}</p>
                      {item.yearPublished && (
                        <p className="text-xs text-gray-500">{item.yearPublished}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              My Trades
            </h2>
            <div title={forTradeItems.length === 0 ? 'Mark at least one game as "For Trade" to create an offer' : ''}>
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={forTradeItems.length === 0}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + New Trade Offer
              </button>
            </div>
          </div>

          {loadError && (
            <p className="text-xs text-amber-400 mb-3" role="alert">
              {loadError}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myTrades.length === 0 ? (
            <div className="text-center py-16 text-gray-600 bg-white/3 rounded-xl border border-white/10">
              <p className="text-3xl mb-3">🤝</p>
              <p className="font-medium">No trades yet</p>
              <p className="text-sm mt-1">
                Mark games as "For Trade" to list them above, then create trade requests.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTrades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  currentUserId={user?.id ?? ''}
                  onRespond={(accept) => void respond(trade.id, accept)}
                  onCancel={() => void cancel(trade.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreateModal && (
        <CreateTradeModal
          forTradeItems={forTradeItems}
          publicForTrade={publicForTrade}
          currentUserId={user?.id ?? ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTradeCreated}
        />
      )}
    </div>
  );
}
