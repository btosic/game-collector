import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const CACHE_TTL = 300; // 5 minutes

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          description
          handle
          images(first: 1) {
            edges { node { url altText } }
          }
          priceRange {
            minVariantPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  image: string | null;
  imageAlt: string | null;
  price: string;
  currency: string;
}

interface GqlProductNode {
  id: string;
  title: string;
  description: string;
  handle: string;
  images: { edges: Array<{ node: { url: string; altText: string } }> };
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
}

interface GqlResponse {
  data: { products: { edges: Array<{ node: GqlProductNode }> } };
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getProducts(first = 12): Promise<ShopifyProduct[]> {
    const key = `shopify:products:${first}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as ShopifyProduct[];

    const apiUrl = this.config.get<string>('SHOPIFY_STOREFRONT_API_URL');
    const token = this.config.get<string>('SHOPIFY_STOREFRONT_ACCESS_TOKEN');

    if (!apiUrl || !token) {
      this.logger.warn('Shopify not configured — returning mock products');
      return MOCK_PRODUCTS;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Storefront-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first } }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as GqlResponse;

      const products = data.data.products.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.description,
        handle: node.handle,
        image: node.images.edges[0]?.node.url ?? null,
        imageAlt: node.images.edges[0]?.node.altText ?? null,
        price: node.priceRange.minVariantPrice.amount,
        currency: node.priceRange.minVariantPrice.currencyCode,
      }));

      await this.redis.set(key, JSON.stringify(products), 'EX', CACHE_TTL);
      return products;
    } catch (err) {
      this.logger.error('Shopify API error — returning mock products', err);
      return MOCK_PRODUCTS;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

const MOCK_PRODUCTS: ShopifyProduct[] = [
  { id: 'mock-1', title: 'Custom Dice Set — Obsidian', description: 'Premium hand-crafted obsidian resin dice.', handle: 'obsidian-dice', image: null, imageAlt: null, price: '24.99', currency: 'USD' },
  { id: 'mock-2', title: 'Neoprene Playmat — Forest', description: 'Large non-slip neoprene playmat with immersive art.', handle: 'forest-playmat', image: null, imageAlt: null, price: '34.99', currency: 'USD' },
  { id: 'mock-3', title: 'Card Sleeves — Matte 100pk', description: 'Perfect-fit matte sleeves for standard size cards.', handle: 'matte-sleeves', image: null, imageAlt: null, price: '8.99', currency: 'USD' },
  { id: 'mock-4', title: 'Modular Foam Insert', description: 'Universal foam insert system for game storage.', handle: 'foam-insert', image: null, imageAlt: null, price: '19.99', currency: 'USD' },
  { id: 'mock-5', title: 'Acrylic Dice Tower', description: 'Felt-lined acrylic tower for quiet, fair rolls.', handle: 'acrylic-tower', image: null, imageAlt: null, price: '29.99', currency: 'USD' },
  { id: 'mock-6', title: 'Magnetic Score Tracker', description: 'Compact tracker that fits in any game box.', handle: 'score-tracker', image: null, imageAlt: null, price: '14.99', currency: 'USD' },
  { id: 'mock-7', title: 'Deluxe Token Set', description: '150 mixed wooden tokens in 6 colours.', handle: 'token-set', image: null, imageAlt: null, price: '12.99', currency: 'USD' },
  { id: 'mock-8', title: 'First Player Marker', description: 'Weighted resin first-player crown marker.', handle: 'first-player', image: null, imageAlt: null, price: '9.99', currency: 'USD' },
];
