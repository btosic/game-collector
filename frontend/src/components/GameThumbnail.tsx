export function GameThumbnail({ thumbnail, name }: { thumbnail?: string | null; name: string }) {
  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt={name}
        className="w-10 h-10 rounded object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center flex-shrink-0 text-lg">
      🎲
    </div>
  );
}
