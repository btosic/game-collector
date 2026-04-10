import { useEffect, useState } from 'react';
import { marketApi, type Product } from '../api/market.api';

export default function MarketPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    marketApi
      .getProducts()
      .then(({ data }) => setProducts(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Premium Accessories</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upgrade your game nights with handpicked accessories.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden flex flex-col hover:border-indigo-500/50 transition-colors group">
      {/* Image */}
      <div className="aspect-square bg-gray-900 flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.imageAlt ?? product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-5xl opacity-30">🎲</span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-white leading-tight">
          {product.title}
        </h3>
        <p className="text-xs text-gray-500 mt-1 flex-1 line-clamp-2">
          {product.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-400">
            {product.currency === 'USD' ? '$' : product.currency}
            {product.price}
          </span>
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors"
            onClick={() =>
              window.open(product.url, '_blank', 'noopener,noreferrer')
            }
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}
