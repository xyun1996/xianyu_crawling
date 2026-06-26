// Ported from web.py CrawlManager
// Key architectural change: Python uses a background thread + separate asyncio event loop.
// Node.js is single-threaded — we use setTimeout to schedule crawl rounds.
// await naturally yields control, so HTTP requests can be handled concurrently.

import { runCrawl, firstTimeLogin } from './spider';
import { loadKeywords, saveKeywords, hasCookies, CRAWL_INTERVAL_MINUTES, MAX_HISTORY_ROUNDS } from './config';
import type { KeywordEntry, CrawlStatus, CrawlHistoryEntry, CrawledItem, CrawlDetail } from './types';

const GLOBAL_KEY = '__xianyu_crawl_manager__';

export function getCrawlManager(): CrawlManager {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new CrawlManager();
  }
  return g[GLOBAL_KEY];
}

export class CrawlManager {
  private paused = true;
  private crawlingNow = false;
  private interval = CRAWL_INTERVAL_MINUTES;
  private keywords: KeywordEntry[] = loadKeywords();
  private maxRounds: number | null = null;
  private totalRounds = 0;      // global round counter, never resets
  private sessionRounds = 0;     // rounds in current start session, resets on start
  private crawlHistory: CrawlHistoryEntry[] = [];
  private loopTimer: NodeJS.Timeout | null = null;
  private loginInProgress = false;
  private lastCrawlTime: string | null = null;
  private lastCrawlSummary: string | null = null;

  // Real-time progress tracking
  private currentKeyword: string | null = null;
  private currentKeywordIndex = 0;
  private currentRoundItems: CrawledItem[] = [];

  // Keyword selection for crawl rounds (ephemeral, not persisted)
  private selectedKeywords: KeywordEntry[] = [];
  private lastRoundKeywords: KeywordEntry[] = [];
  private activeCrawlKeywords: KeywordEntry[] = [];

  constructor() {
    console.log('[CrawlManager] Initialized');
  }

  /**
   * Start the crawl loop.
   * Resolves which keywords to use: selected → last round → full library → error.
   */
  startCrawl(): { started: boolean; error?: string } {
    if (!this.paused) {
      return { started: false, error: '爬取已在运行中' };
    }

    let crawlKeywords: KeywordEntry[];

    if (this.selectedKeywords.length > 0) {
      crawlKeywords = [...this.selectedKeywords];
    } else if (this.lastRoundKeywords.length > 0) {
      crawlKeywords = [...this.lastRoundKeywords];
    } else if (this.keywords.length > 0) {
      crawlKeywords = [...this.keywords];
    } else {
      return { started: false, error: '没有可用的关键词：请先添加关键词，或选择关键词用于本轮爬取' };
    }

    this.activeCrawlKeywords = crawlKeywords;
    this.paused = false;
    this.sessionRounds = 0;
    this.crawlHistory = [];
    this.scheduleNextCrawl(0);
    console.log('[CrawlManager] Started with keywords:', crawlKeywords.map(k => k.keyword).join(', '));
    return { started: true };
  }

  /**
   * Pause the crawl loop. Current in-progress crawl will finish.
   */
  pauseCrawl(): void {
    this.paused = true;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    console.log('[CrawlManager] Paused');
  }

  /**
   * Set crawl interval in minutes (min 3).
   */
  setInterval(minutes: number): void {
    this.interval = Math.max(3, minutes);
  }

  /**
   * Set keywords (library) and persist to disk.
   * Also prunes selected keywords that no longer exist in the library.
   */
  setKeywords(keywords: KeywordEntry[]): void {
    this.keywords = keywords.filter(kw => kw.keyword.trim() !== '');
    saveKeywords(this.keywords);
    // Remove selections that are no longer in the library
    const libraryKeys = new Set(this.keywords.map(k => k.keyword));
    this.selectedKeywords = this.selectedKeywords.filter(kw => libraryKeys.has(kw.keyword));
  }

  /**
   * Set selected keywords for the next crawl round (ephemeral).
   * Only keeps keywords that exist in the library.
   */
  setSelectedKeywords(keywords: KeywordEntry[]): void {
    const libraryKeys = new Set(this.keywords.map(k => k.keyword));
    this.selectedKeywords = keywords.filter(kw => libraryKeys.has(kw.keyword));
  }

  /**
   * Set max rounds (null = unlimited/continuous).
   */
  setMaxRounds(max: number | null): void {
    this.maxRounds = max;
  }

  /**
   * Get current crawl status for the API.
   */
  getStatus(): CrawlStatus {
    let nextCrawlTime: string | null = null;
    if (!this.paused && !this.crawlingNow && this.lastCrawlTime) {
      const last = new Date(this.lastCrawlTime.replace(' ', 'T'));
      const next = new Date(last.getTime() + this.interval * 60000);
      nextCrawlTime = next.toISOString().replace('T', ' ').substring(0, 19);
    }

    return {
      running: !this.paused,
      paused: this.paused,
      crawling_now: this.crawlingNow,
      interval: this.interval,
      keywords: [...this.keywords],
      last_crawl_time: this.lastCrawlTime,
      last_crawl_summary: this.lastCrawlSummary,
      next_crawl_time: nextCrawlTime,
      max_rounds: this.maxRounds,
      completed_rounds: this.sessionRounds,
      crawl_history: [...this.crawlHistory],
      has_cookies: hasCookies(),
      login_in_progress: this.loginInProgress,
      current_keyword: this.currentKeyword,
      current_keyword_index: this.currentKeywordIndex,
      current_round_items: [...this.currentRoundItems],
      selected_keywords: [...this.selectedKeywords],
      last_round_keywords: [...this.lastRoundKeywords],
      active_crawl_keyword_count: this.activeCrawlKeywords.length,
    };
  }

  /**
   * Initiate login flow.
   */
  async login(): Promise<void> {
    if (this.loginInProgress) return;
    this.loginInProgress = true;

    try {
      await firstTimeLogin();
    } finally {
      this.loginInProgress = false;
    }
  }

  // ====== Private ======

  private scheduleNextCrawl(delayMs: number): void {
    if (this.paused) return;
    if (this.loopTimer) clearTimeout(this.loopTimer);

    this.loopTimer = setTimeout(() => this.executeCrawlRound(), delayMs);
  }

  private async executeCrawlRound(): Promise<void> {
    if (this.paused) return;

    this.crawlingNow = true;
    this.currentRoundItems = [];
    this.currentKeywordIndex = 0;

    try {
      // Run crawl with per-keyword progress callback using active crawl keywords
      const details = await runCrawl(this.activeCrawlKeywords, null, (keyword, index, items) => {
        this.currentKeyword = keyword;
        this.currentKeywordIndex = index;
        // Accumulate items as each keyword completes
        this.currentRoundItems = [...this.currentRoundItems, ...items];
      });

      // Build history entry from accumulated items
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const allItems = this.currentRoundItems;

      const entry: CrawlHistoryEntry = {
        time: now,
        round: this.totalRounds + 1,
        items: allItems,
      };

      this.crawlHistory.push(entry);
      if (this.crawlHistory.length > MAX_HISTORY_ROUNDS) {
        this.crawlHistory = this.crawlHistory.slice(-MAX_HISTORY_ROUNDS);
      }

      this.totalRounds++;
      this.sessionRounds++;
      this.lastCrawlTime = now;
      this.lastRoundKeywords = [...this.activeCrawlKeywords];

      // Build summary
      const totalItems = allItems.length;
      const newItems = allItems.filter(i => i.is_new).length;
      const priceChanges = allItems.filter(i => i.price_change !== null && i.price_change !== 0).length;
      this.lastCrawlSummary = `第${this.totalRounds}轮: ${totalItems}商品 | ${newItems}新 | ${priceChanges}价格变动`;

      // Check if max rounds reached
      if (this.maxRounds !== null && this.sessionRounds >= this.maxRounds) {
        this.paused = true;
        console.log(`[CrawlManager] Max rounds (${this.maxRounds}) reached, paused`);
        return;
      }
    } catch (e) {
      console.error('[CrawlManager] Crawl error:', e);
    } finally {
      this.crawlingNow = false;
      this.currentKeyword = null;
      this.currentRoundItems = [];
    }

    // Schedule next round
    this.scheduleNextCrawl(this.interval * 60000);
  }
}
