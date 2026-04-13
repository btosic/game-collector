import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MarketService, ShopifyProduct } from './market.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const SHOPIFY_URL = 'https://test-store.myshopify.com/api/2024-01/graphql.json';
const SHOPIFY_TOKEN = 'test-storefront-token';

const mockGqlResponse = {
  data: {
    products: {
      edges: [
        {
          node: {
            id: 'gid://shopify/Product/1',
            title: 'Custom Dice Set',
            description: 'Premium dice.',
            handle: 'custom-dice',
            images: { edges: [{ node: { url: 'https://cdn.shopify.com/dice.jpg', altText: 'Dice' } }] },
            priceRange: { minVariantPrice: { amount: '24.99', currencyCode: 'USD' } },
            variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/111222333' } }] },
          },
        },
      ],
    },
  },
};

describe('MarketService', () => {
  let service: MarketService;
  let config: jest.Mocked<Pick<ConfigService, 'get' | 'getOrThrow'>>;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    redis = { get: jest.fn(), set: jest.fn().mockResolvedValue('OK') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(MarketService);
    config = module.get(ConfigService);
  });

  describe('getProducts', () => {
    it('returns cached products on a Redis cache hit without calling Shopify', async () => {
      const cached: ShopifyProduct[] = [
        { id: 'mock-1', title: 'Cached Product', description: '', handle: 'cached', url: 'http://store/cart/1:1', image: null, imageAlt: null, price: '9.99', currency: 'USD' },
      ];
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getProducts(1);

      expect(result).toEqual(cached);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('returns mock products when Shopify environment variables are not set', async () => {
      redis.get.mockResolvedValue(null);
      (config.get as jest.Mock).mockReturnValue(undefined);

      const result = await service.getProducts(12);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((p) => p.id.startsWith('mock-'))).toBe(true);
    });

    it('fetches products from Shopify, caches them, and returns them', async () => {
      redis.get.mockResolvedValue(null);
      (config.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SHOPIFY_STOREFRONT_API_URL') return SHOPIFY_URL;
        if (key === 'SHOPIFY_STOREFRONT_ACCESS_TOKEN') return SHOPIFY_TOKEN;
        return undefined;
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGqlResponse),
      }) as unknown as typeof fetch;

      const result = await service.getProducts(1);

      expect(global.fetch).toHaveBeenCalledWith(
        SHOPIFY_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN,
          }),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Custom Dice Set');
      expect(result[0].price).toBe('24.99');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('shopify:products'),
        expect.any(String),
        'EX',
        300,
      );
    });

    it('builds the correct cart checkout URL from the variant GID', async () => {
      redis.get.mockResolvedValue(null);
      (config.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SHOPIFY_STOREFRONT_API_URL') return SHOPIFY_URL;
        if (key === 'SHOPIFY_STOREFRONT_ACCESS_TOKEN') return SHOPIFY_TOKEN;
        return undefined;
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGqlResponse),
      }) as unknown as typeof fetch;

      const [product] = await service.getProducts(1);

      expect(product.url).toBe('https://test-store.myshopify.com/cart/111222333:1');
    });

    it('returns mock products when the Shopify API returns a non-OK response', async () => {
      redis.get.mockResolvedValue(null);
      (config.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SHOPIFY_STOREFRONT_API_URL') return SHOPIFY_URL;
        if (key === 'SHOPIFY_STOREFRONT_ACCESS_TOKEN') return SHOPIFY_TOKEN;
        return undefined;
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }) as unknown as typeof fetch;

      const result = await service.getProducts(12);

      expect(result.every((p) => p.id.startsWith('mock-'))).toBe(true);
    });

    it('returns mock products when fetch throws a network error', async () => {
      redis.get.mockResolvedValue(null);
      (config.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SHOPIFY_STOREFRONT_API_URL') return SHOPIFY_URL;
        if (key === 'SHOPIFY_STOREFRONT_ACCESS_TOKEN') return SHOPIFY_TOKEN;
        return undefined;
      });
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

      const result = await service.getProducts(12);

      expect(result.every((p) => p.id.startsWith('mock-'))).toBe(true);
    });
  });
});
