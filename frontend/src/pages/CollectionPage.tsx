import { useEffect, useState, type FormEvent } from 'react';
import { gamesApi, type BggSearchResult, type CollectionEntry, type GameStatus } from '../api/games.api';
import { GameStatusBadge } from '../components/StatusBadge';

const STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: 'IN_COLLECTION', label: 'In Collection' },
  { value: 'WISHLIST', label: 'Wishlist' },
  { value: 'FOR_TRADE', label: 'For Trade' },
];

export default function CollectionPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BggSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    gamesApi
      .getCollection()
      .then(({ data }) => setCollection(data))
      .finally(() => setLoadingCollection(false));
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = await gamesApi.search(query);
      setSearchResults(data.slice(0, 20));
    } finally {
      setSearching(false);
    }
  };

  const addGame = async (game: BggSearchResult, status: GameStatus = 'IN_COLLECTION') => {
    setAdding(game.id);
    try {
      const { data } = await gamesApi.addToCollection(game.id, status);
      setCollection((c) => [data, ...c]);
    } catch {
      /* already in collection or network error — ignore silently */
    } finally {
      setAdding(null);
    }
  };

  const updateStatus = async (id: string, status: GameStatus) => {
    const { data } = await gamesApi.updateStatus(id, status);
    setCollection((c) => c.map((e) => (e.id === id ? data : e)));
  };

  const remove = async (id: string) => {
    await gamesApi.removeFromCollection(id);
    setCollection((c) => c.filter((e) => e.id !== id));
  };

  const inCollection = collection.filter((e) => e.status !== 'FOR_TRADE');
  const forTrade = collection.filter((e) => e.status === 'FOR_TRADE');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">My Collection</h1>
        <p className="text-gray-500 text-sm mt-1">
          Search BoardGameGeek to add games to your collection.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games on BoardGameGeek…"
          className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Search results */}
      {searchResults.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Search Results
          </h2>
          <div className="space-y-2">
            {searchResults.map((game) => {
              const owned = collection.some((e) => e.bggGameId === game.id);
              return (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{game.name}</p>
                    {game.yearPublished && (
                      <p className="text-xs text-gray-500">{game.yearPublished}</p>
                    )}
                  </div>
                  {owned ? (
                    <span className="text-xs text-gray-600 px-3 py-1.5 rounded-lg bg-white/5">
                      In collection
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => void addGame(game, value)}
                          disabled={adding === game.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-indigo-600/40 disabled:opacity-50 transition-colors"
                        >
                          + {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Collection */}
      {loadingCollection ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : collection.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🎲</p>
          <p className="font-medium">Your collection is empty.</p>
          <p className="text-sm mt-1">Search above to add your first game.</p>
        </div>
      ) : (
        <>
          {inCollection.length > 0 && (
            <CollectionSection
              title="Games"
              entries={inCollection}
              onStatusChange={(id, status) => void updateStatus(id, status)}
              onRemove={(id) => void remove(id)}
            />
          )}
          {forTrade.length > 0 && (
            <CollectionSection
              title="Available for Trade"
              entries={forTrade}
              onStatusChange={(id, status) => void updateStatus(id, status)}
              onRemove={(id) => void remove(id)}
            />
          )}
        </>
      )}
    </div>
  );
}

function CollectionSection({
  title,
  entries,
  onStatusChange,
  onRemove,
}: {
  title: string;
  entries: CollectionEntry[];
  onStatusChange: (id: string, status: GameStatus) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title} ({entries.length})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              {entry.thumbnail ? (
                <img
                  src={entry.thumbnail}
                  alt={entry.name}
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center flex-shrink-0 text-xl">
                  🎲
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-tight truncate">
                  {entry.name}
                </p>
                {entry.yearPublished && (
                  <p className="text-xs text-gray-600">{entry.yearPublished}</p>
                )}
                <div className="mt-1">
                  <GameStatusBadge status={entry.status} />
                </div>
              </div>
            </div>

            <div className="flex gap-1 flex-wrap">
              {(['IN_COLLECTION', 'WISHLIST', 'FOR_TRADE'] as GameStatus[])
                .filter((s) => s !== entry.status)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(entry.id, s)}
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
                  >
                    {s === 'IN_COLLECTION' ? 'Own' : s === 'WISHLIST' ? 'Wishlist' : 'Trade'}
                  </button>
                ))}
              <button
                onClick={() => onRemove(entry.id)}
                className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors ml-auto"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
