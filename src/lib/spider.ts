// Ported from spider.py

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import {
  SEARCH_URL_TEMPLATE,
  SCROLL_COUNT,
  RANDOM_DELAY_MIN,
  RANDOM_DELAY_MAX,
  PAGE_LOAD_TIMEOUT,
  BROWSER_VIEWPORT,
  BROWSER_USER_AGENT,
  BROWSER_LOCALE,
  BROWSER_ARGS,
  LOGIN_WAIT_TIMEOUT,
  LOGIN_RECHECK_INTERVAL,
  POST_NAVIGATION_SLEEP,
  INTER_KEYWORD_DELAY_MIN,
  INTER_KEYWORD_DELAY_MAX,
  COOKIE_PATH,
  DEBUG_DIR,
  HEADLESS,
  ensureDir,
  getKeywordCategoryMap,
  hasCookies,
  loadKeywords,
} from './config';
import {
  upsertProduct,
  addPriceSnapshot,
  markInactiveProducts,
  getLastPriceBefore,
} from './db';
import type { Product, CrawlResult, CrawlDetail, KeywordEntry } from './types';

// Playwright private cookie fields that must be stripped before save/load
const PLAYWRIGHT_PRIVATE_KEYS = new Set(['partitionKey', '_crHasCrossSiteAncestor']);

// Shutdown flag
let shutdownRequested = false;

export function resetShutdown(): void {
  shutdownRequested = false;
}

// ====== Browser Singleton ======

const BROWSER_KEY = '__xianyu_browser__';

async function getBrowser(): Promise<Browser> {
  const g = globalThis as any;
  if (!g[BROWSER_KEY] || !g[BROWSER_KEY].isConnected()) {
    g[BROWSER_KEY] = await chromium.launch({
      headless: HEADLESS,
      args: BROWSER_ARGS,
    });
  }
  return g[BROWSER_KEY];
}

// ====== Utility Functions ======

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function interruptibleSleep(seconds: number): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (shutdownRequested) throw new Error('Shutdown requested');
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(remaining, 500));
  }
}

async function randomDelay(): Promise<void> {
  const delay = Math.random() * (RANDOM_DELAY_MAX - RANDOM_DELAY_MIN) + RANDOM_DELAY_MIN;
  await interruptibleSleep(delay);
}

function parsePrice(priceText: string): number {
  if (!priceText) return 0;
  const match = priceText.match(/\d+\.?\d*/);
  if (match) {
    const val = parseFloat(match[0]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

// ====== Cookie Management ======

function sanitizeCookies(cookies: any[]): any[] {
  const now = Date.now() / 1000;
  const clean: any[] = [];
  for (const c of cookies) {
    const sanitized = Object.fromEntries(
      Object.entries(c).filter(([k]) => !PLAYWRIGHT_PRIVATE_KEYS.has(k))
    );
    const expires: number = (sanitized.expires as number) ?? -1;
    if (expires !== -1 && expires < now) continue;
    clean.push(sanitized);
  }
  return clean;
}

async function saveCookies(context: BrowserContext): Promise<void> {
  ensureDir(path.dirname(COOKIE_PATH));
  const cookies = sanitizeCookies(await context.cookies());
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2), 'utf-8');
  console.log(`  [Cookie] Saved to ${COOKIE_PATH} (${cookies.length} valid)`);
}

async function loadCookies(context: BrowserContext): Promise<boolean> {
  if (!fs.existsSync(COOKIE_PATH)) return false;
  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf-8');
    const cookies = JSON.parse(raw);
    if (!cookies || cookies.length === 0) return false;
    const sanitized = sanitizeCookies(cookies);
    if (sanitized.length === 0) {
      console.log('  [Cookie] All cookies expired, need to re-login');
      return false;
    }
    await context.addCookies(sanitized);
    console.log(`  [Cookie] Loaded from ${COOKIE_PATH} (${sanitized.length} valid)`);
    return true;
  } catch (e) {
    console.log(`  [Cookie] Load failed: ${e}`);
    return false;
  }
}

// ====== Login Detection ======

async function checkLoginStatus(page: Page): Promise<boolean> {
  try {
    await interruptibleSleep(1);
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) return false;

    const nickEl = page.locator('[class*="nick--"]');
    try {
      const count = await nickEl.count();
      if (count > 0 && await nickEl.first().isVisible()) {
        const nickText = await nickEl.first().evaluate((el: Element) => el.textContent?.trim() || '');
        if (nickText && nickText !== '登录') return true;
      }
    } catch {
      // Element not found or not visible
    }
    return false;
  } catch {
    return false;
  }
}

async function waitForManualLogin(page: Page): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('  ⚠️  Not logged in or cookies expired. Please log in manually.');
  console.log('  Login will auto-detect and continue...');
  console.log('  (Max wait: 5 minutes, Ctrl+C to cancel)');
  console.log('='.repeat(60) + '\n');

  let lastNavigateTime = 0;
  try {
    for (let i = 0; i < LOGIN_WAIT_TIMEOUT; i++) {
      await interruptibleSleep(1);
      if (shutdownRequested) {
        console.log('\n  ⏹️  Interrupt signal received, cancelling login wait');
        return false;
      }

      if (await checkLoginStatus(page)) {
        console.log('  ✅ Login successful!');
        return true;
      }

      // Re-navigate to homepage every 30 seconds to re-check
      const currentTime = Date.now() / 1000;
      if (i > 0 && i % LOGIN_RECHECK_INTERVAL === 0 && currentTime - lastNavigateTime > 25) {
        lastNavigateTime = currentTime;
        try {
          await page.goto('https://www.goofish.com/', { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
          await interruptibleSleep(2);
          if (await checkLoginStatus(page)) {
            console.log('  ✅ Login successful!');
            return true;
          }
          console.log(`  [Login] Waiting... (${i} seconds)`);
        } catch (e: any) {
          if (e.message === 'Shutdown requested') throw e;
          // Navigation failed, continue waiting
        }
      }
    }
  } catch (e: any) {
    if (e.message === 'Shutdown requested') {
      console.log('\n  ⏹️  Interrupt signal received, cancelling login wait');
      return false;
    }
    throw e;
  }

  console.log('  ❌ Login timeout, please try again');
  return false;
}

// ====== Page Scrolling ======

async function scrollPage(page: Page, count: number = SCROLL_COUNT): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await randomDelay();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await interruptibleSleep(1);
}

// ====== Item Extraction ======

async function extractItems(page: Page, keyword: string): Promise<Product[]> {
  const products: Product[] = [];

  // Primary extraction strategy
  const itemData = await page.evaluate(() => {
    const results: any[] = [];
    const cards = document.querySelectorAll('[class*="feeds-item-wrap"]');
    const seenIds = new Set<string>();

    cards.forEach(card => {
      const href = card.getAttribute('href') || '';
      const idMatch = href.match(/[?&]id=(\d+)/);
      const itemId = idMatch ? idMatch[1] : '';
      if (!itemId || seenIds.has(itemId)) return;
      seenIds.add(itemId);

      const titleEl = card.querySelector('[class*="main-title"]');
      const title = titleEl ? (titleEl.textContent?.trim() || '') : '';

      let priceText = '';
      const priceWrapEl = card.querySelector('[class*="price-wrap"]');
      if (priceWrapEl) {
        priceText = priceWrapEl.textContent?.trim() || '';
      } else {
        const priceEl = card.querySelector('[class*="price"]');
        if (priceEl) {
          priceText = priceEl.textContent?.trim() || '';
        }
      }

      let location = '';
      const sellerEl = card.querySelector('[class*="row4-wrap-seller"]');
      if (sellerEl) {
        const sellerText = sellerEl.textContent?.trim() || '';
        const areaMatch = sellerText.match(/^([一-鿿]{2,3})(?:卖家|发货|地区)/);
        if (areaMatch) location = areaMatch[1];
      }

      const imgEl = card.querySelector('img[src*="img.alicdn"], img[src*="goofish"]');
      const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';

      results.push({
        itemId,
        title: title.substring(0, 200),
        priceText,
        location,
        imageUrl,
      });
    });

    return results;
  });

  if (itemData) {
    for (const item of itemData) {
      const price = parsePrice(item.priceText || '');
      if (!item.title || price <= 0) continue;

      products.push({
        id: null,
        item_id: item.itemId,
        title: item.title,
        price,
        seller_name: '',
        location: item.location || '',
        condition: '',
        image_url: item.imageUrl || '',
        search_keyword: keyword,
        category: '',
        first_seen_at: null,
        last_seen_at: null,
        is_active: true,
      });
    }
  }

  // Fallback: try alternative selectors if primary yields 0
  if (products.length === 0) {
    const fallbackData = await page.evaluate(() => {
      const results: any[] = [];
      const selectors = [
        '[class*="feeds-item"]',
        '[class*="item-card"]',
        '[class*="card-item"]',
        '[class*="commodityCard"]',
        '[class*="search-item"]',
        '[data-spm*="item"]',
      ];

      let cards: Element[] = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          cards = Array.from(found);
          break;
        }
      }

      cards.forEach(card => {
        const titleEl = card.querySelector('[class*="title"], [class*="Title"], h3, h4, p');
        const priceEl = card.querySelector('[class*="price-wrap"], [class*="price"], [class*="Price"]');
        const locationEl = card.querySelector('[class*="row4-wrap-seller"], [class*="location"], [class*="area"]');
        const linkEl = card.querySelector('a[href*="/item/"], a[href*="item.htm"], a[href*="item?id="]');

        let itemId = '';
        if (linkEl) {
          const href = linkEl.getAttribute('href') || '';
          const m1 = href.match(/\/item\/(\d+)/);
          const m2 = href.match(/[?&]id=(\d+)/);
          if (m1) itemId = m1[1];
          else if (m2) itemId = m2[1];
        }

        const title = titleEl ? (titleEl.textContent?.trim() || '') : '';
        let priceText = '';
        if (priceEl) priceText = priceEl.textContent?.trim() || '';

        let location = '';
        if (locationEl) {
          const sellerText = locationEl.textContent?.trim() || '';
          const areaMatch = sellerText.match(/^([一-鿿]{2,3})(?:卖家|发货|地区)/);
          if (areaMatch) location = areaMatch[1];
        }

        if (title && priceText) {
          results.push({
            itemId: itemId || 'unknown_' + Math.random().toString(36).substring(2, 11),
            title: title.substring(0, 200),
            priceText,
            location,
            imageUrl: '',
          });
        }
      });

      return results;
    });

    for (const item of fallbackData) {
      const price = parsePrice(item.priceText || '');
      if (price <= 0) continue;

      products.push({
        id: null,
        item_id: item.itemId,
        title: item.title,
        price,
        seller_name: '',
        location: item.location || '',
        condition: '',
        image_url: item.imageUrl || '',
        search_keyword: keyword,
        category: '',
        first_seen_at: null,
        last_seen_at: null,
        is_active: true,
      });
    }
  }

  return products;
}

// ====== Single Keyword Crawl ======

async function crawlKeyword(context: BrowserContext, keyword: string): Promise<[CrawlResult, any[]]> {
  const result: CrawlResult = { keyword, total_items: 0, new_items: 0, price_changes: 0, errors: 0 };
  const itemsDetail: any[] = [];
  let page: Page | null = null;

  try {
    page = await context.newPage();

    const url = SEARCH_URL_TEMPLATE.replace('{keyword}', encodeURIComponent(keyword));
    console.log(`\n  [Crawl] Visiting: ${url}`);

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });

    if (response && response.status() === 403) {
      console.log('  ⚠️  Access denied (403), may need to re-login');
      result.errors++;
      return [result, itemsDetail];
    }

    // Wait for page load
    await interruptibleSleep(POST_NAVIGATION_SLEEP);

    // Check login
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('  ⚠️  Page redirected to login, cookies may be expired');
      if (!await waitForManualLogin(page)) {
        result.errors++;
        return [result, itemsDetail];
      }
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
      await interruptibleSleep(POST_NAVIGATION_SLEEP);
    }

    // Scroll to load more items
    await scrollPage(page);

    // Extract items
    const products = await extractItems(page, keyword);
    result.total_items = products.length;

    if (products.length === 0) {
      console.log('  [Note] No items extracted, page structure may have changed');
      console.log(`  [Debug] Current URL: ${page.url}`);
      ensureDir(DEBUG_DIR);
      const timestamp = new Date().toISOString().replace(/[:-]/g, '').substring(0, 15);
      const debugPath = path.join(DEBUG_DIR, `debug_${timestamp}.png`);
      try {
        await page.screenshot({ path: debugPath, fullPage: false });
        console.log(`  [Debug] Screenshot saved: ${debugPath}`);
      } catch {
        // Screenshot failed, ignore
      }
      result.errors++;
      return [result, itemsDetail];
    }

    // Process extracted products
    const activeItemIds = new Set<string>();
    const categoryMap = getKeywordCategoryMap();

    for (const product of products) {
      activeItemIds.add(product.item_id);

      const category = categoryMap[product.search_keyword] || '';
      const { product: dbProduct, isNew, priceChanged } = upsertProduct(product, category);

      // Build detail record
      let priceChangeVal: number | null = null;
      if (!isNew && priceChanged && dbProduct.id) {
        const lastPrice = getLastPriceBefore(dbProduct.id);
        if (lastPrice !== null) {
          priceChangeVal = Math.round((product.price - lastPrice) * 100) / 100;
        }
      }

      itemsDetail.push({
        keyword: keyword,
        title: product.title,
        price: product.price,
        first_seen_at: dbProduct.first_seen_at ? String(dbProduct.first_seen_at).substring(0, 16) : '',
        is_new: isNew,
        price_change: priceChangeVal,
      });

      if (isNew) {
        result.new_items++;
        console.log(`  🆕 New: ${product.title.substring(0, 40)}... ¥${product.price} (${product.location})`);
      } else if (priceChanged) {
        result.price_changes++;
        console.log(`  💰 Price change: ${product.title.substring(0, 40)}... ¥${product.price}`);
      }

      // Record price snapshot
      if (dbProduct.id) {
        addPriceSnapshot(dbProduct.id, product.price);
      }
    }

    // Mark inactive products
    markInactiveProducts(activeItemIds, keyword);

  } catch (e) {
    console.log(`  ❌ Crawl failed: ${e}`);
    result.errors++;
  } finally {
    if (page) await page.close();
  }

  return [result, itemsDetail];
}

// ====== Full Crawl Cycle ======

export type CrawlProgressCallback = (keyword: string, index: number, items: any[]) => void;

export async function runCrawl(
  keywords: KeywordEntry[] | null = null,
  headless: boolean | null = null,
  onKeywordComplete?: CrawlProgressCallback
): Promise<CrawlDetail[]> {
  resetShutdown();

  if (keywords === null) {
    keywords = loadKeywords();
  }
  const keywordStrings = keywords.map(kw => kw.keyword);

  if (headless === null) headless = HEADLESS;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  🔍 Xianyu Price Monitor - ${new Date().toISOString().substring(0, 19).replace('T', ' ')}`);
  console.log(`  Keywords: ${keywordStrings.join(', ')}`);
  console.log(`${'='.repeat(60)}`);

  const crawlDetails: CrawlDetail[] = [];

  try {
    const browser = await getBrowser();

    const context = await browser.newContext({
      viewport: BROWSER_VIEWPORT,
      userAgent: BROWSER_USER_AGENT,
      locale: BROWSER_LOCALE,
    });

    // Inject anti-detection script
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    });

    // Load cookies
    let hasValidCookies = await loadCookies(context);

    // Verify cookie validity if we have them
    if (hasValidCookies) {
      const verifyPage = await context.newPage();
      try {
        await verifyPage.goto('https://www.goofish.com/', { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
        await interruptibleSleep(2);
        if (!await checkLoginStatus(verifyPage)) {
          console.log('  [Cookie] Cookies expired, need to re-login');
          hasValidCookies = false;
          try { fs.unlinkSync(COOKIE_PATH); } catch { /* ignore */ }
        }
      } catch (e: any) {
        if (e.message === 'Shutdown requested') throw e;
        console.log(`  [Cookie] Login verification failed: ${e}`);
        hasValidCookies = false;
      } finally {
        await verifyPage.close();
      }
    }

    // If no valid cookies, open login page
    if (!hasValidCookies) {
      const loginPage = await context.newPage();
      await loginPage.goto('https://www.goofish.com/', { waitUntil: 'domcontentloaded' });
      if (!await checkLoginStatus(loginPage)) {
        if (!await waitForManualLogin(loginPage)) {
          console.log('  ❌ Cannot login, crawl aborted');
          await loginPage.close();
          await context.close();
          return crawlDetails;
        }
      }
      await saveCookies(context);
      await loginPage.close();
    }

    // Crawl each keyword
    const allResults: CrawlResult[] = [];
    for (let i = 0; i < keywordStrings.length; i++) {
      if (shutdownRequested) break;

      if (i > 0) {
        await interruptibleSleep(
          Math.random() * (INTER_KEYWORD_DELAY_MAX - INTER_KEYWORD_DELAY_MIN) + INTER_KEYWORD_DELAY_MIN
        );
      }

      const [result, items] = await crawlKeyword(context, keywordStrings[i]);
      allResults.push(result);
      crawlDetails.push({ keyword: keywordStrings[i], items });

      // Notify progress after each keyword completes
      if (onKeywordComplete) {
        onKeywordComplete(keywordStrings[i], i, items);
      }

      console.log(
        `  📊 [${keywordStrings[i]}] ${result.total_items} items | ` +
        `${result.new_items} new | ${result.price_changes} price changes | ${result.errors} errors`
      );
    }

    // Save cookies after crawl
    await saveCookies(context);
    await context.close();

  } catch (e: any) {
    if (e.message === 'Shutdown requested') {
      console.log('\n  ⏹️  Interrupt signal received, stopping...');
    } else {
      console.log(`  ❌ Crawl error: ${e}`);
    }
  }

  // Summary
  const totalItems = crawlDetails.reduce((sum, d) => sum + d.items.length, 0);
  const totalNew = crawlDetails.reduce((sum, d) => sum + d.items.filter(i => i.is_new).length, 0);
  const totalChanges = crawlDetails.reduce((sum, d) => sum + d.items.filter(i => i.price_change !== null).length, 0);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  📊 Crawl Summary`);
  console.log(`  Total: ${totalItems} | New: ${totalNew} | Price changes: ${totalChanges}`);
  console.log(`${'='.repeat(60)}\n`);

  return crawlDetails;
}

// ====== First-time Login ======

export async function firstTimeLogin(): Promise<boolean> {
  resetShutdown();
  console.log('\n  🚀 First run, need to login to Xianyu');
  console.log('  Opening browser for manual login...');
  console.log('  Press Ctrl+C to cancel\n');

  try {
    const browser = await chromium.launch({
      headless: false,
      args: BROWSER_ARGS,
    });

    const context = await browser.newContext({
      viewport: BROWSER_VIEWPORT,
      userAgent: BROWSER_USER_AGENT,
      locale: BROWSER_LOCALE,
    });

    // Inject anti-detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    });

    const page = await context.newPage();

    try {
      console.log('  [Login] Opening Xianyu homepage...');
      await page.goto('https://www.goofish.com/', { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
      console.log(`  [Login] Page loaded, URL: ${page.url}`);
    } catch (e) {
      console.log(`  ⚠️  Page load error: ${e}`);
      console.log('  [Login] Trying to continue, please operate manually in browser...');
    }

    await interruptibleSleep(3);

    if (await checkLoginStatus(page)) {
      console.log('  ✅ Already logged in');
      await saveCookies(context);
      console.log('\n  ✅ Cookies saved. Monitoring can now start.\n');
      await browser.close();
      return true;
    }

    console.log('  [Login] Not logged in, please login manually in the browser...');
    if (await waitForManualLogin(page)) {
      await saveCookies(context);
      console.log('\n  ✅ Login successful! Cookies saved. Monitoring can now start.\n');
      await browser.close();
      return true;
    }

    if (shutdownRequested) {
      console.log('\n  ⏹️  Login cancelled\n');
    } else {
      console.log('\n  ❌ Login failed, please try again\n');
    }

    await browser.close();
    return false;
  } catch (e: any) {
    if (e.message === 'Shutdown requested') {
      console.log('\n  ⏹️  Interrupt signal, stopping...');
    } else {
      console.log(`  ❌ Browser launch failed: ${e}`);
      console.log('  Tip: Install Playwright browsers: npx playwright install chromium');
    }
    return false;
  }
}
