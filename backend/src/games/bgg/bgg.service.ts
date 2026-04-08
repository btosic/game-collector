import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { parseStringPromise } from 'xml2js';
import { REDIS_CLIENT } from '../../redis/redis.module';

const CACHE_TTL = 3600; // 1 hour per spec

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

/* ── xml2js raw shapes ─────────────────────────────────────── */
interface BggXmlName {
  $: { type: string; value: string };
}

interface BggXmlSearchItem {
  $: { id: string };
  name: BggXmlName | BggXmlName[];
  yearpublished?: { $: { value: string } };
}

interface BggXmlThingItem {
  $: { id: string };
  name: BggXmlName | BggXmlName[];
  yearpublished?: { $: { value: string } };
  thumbnail?: string;
  image?: string;
  description?: string;
  minplayers?: { $: { value: string } };
  maxplayers?: { $: { value: string } };
  statistics?: {
    ratings?: { average?: { $: { value: string } } };
  };
}

@Injectable()
export class BggService {
  private readonly logger = new Logger(BggService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.baseUrl = config.getOrThrow<string>('BGG_API_BASE_URL');
    this.token = config.getOrThrow<string>('BGG_TOKEN');
  }

  async search(query: string): Promise<BggSearchResult[]> {
    const key = `bgg:search:${query.toLowerCase().trim()}`;
    const hit = await this.redis.get(key);
    if (hit) {
      this.logger.debug(`BGG cache hit – search: ${query}`);
      return JSON.parse(hit) as BggSearchResult[];
    }

    this.logger.debug(`BGG cache miss – search: ${query}`);
    const searchParams = new URLSearchParams({ query, type: 'boardgame' });
    const xml = await this.fetchText(`/search?${searchParams.toString()}`);

    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const items: BggXmlSearchItem[] | BggXmlSearchItem =
      parsed?.items?.item ?? [];

    const list = Array.isArray(items) ? items : [items];
    const results: BggSearchResult[] = list.map((item) => ({
      id: item.$.id,
      name: Array.isArray(item.name)
        ? (item.name[0]?.$.value ?? '')
        : (item.name?.$.value ?? ''),
      yearPublished: item.yearpublished?.$.value ?? null,
    }));

    await this.redis.set(key, JSON.stringify(results), 'EX', CACHE_TTL);
    return results;
  }

  async getGame(id: string): Promise<BggGameDetail | null> {
    const key = `bgg:game:${id}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as BggGameDetail;

    const thingParams = new URLSearchParams({
      id,
      type: 'boardgame',
      stats: '1',
    });
    const xml = await this.fetchText(`/thing?${thingParams.toString()}`);

    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const item: BggXmlThingItem | undefined = parsed?.items?.item;
    if (!item) return null;

    const names = Array.isArray(item.name) ? item.name : [item.name];
    const primaryName =
      names.find((n) => n.$.type === 'primary')?.$.value ?? '';

    const result: BggGameDetail = {
      id: item.$.id,
      name: primaryName,
      yearPublished: item.yearpublished?.$.value ?? null,
      thumbnail: item.thumbnail ?? null,
      image: item.image ?? null,
      description: item.description ?? null,
      minPlayers: item.minplayers?.$.value ?? null,
      maxPlayers: item.maxplayers?.$.value ?? null,
      rating: item.statistics?.ratings?.average?.$.value ?? null,
    };

    await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  }

  private async fetchText(path: string, timeoutMs = 8000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
