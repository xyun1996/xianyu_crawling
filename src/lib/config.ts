// Ported from config.py

import path from 'path';
import fs from 'fs';
import type { KeywordEntry } from './types';

// Resolve paths relative to the monorepo root (G:\workspace\ai\xianyu\)
// In compiled Next.js, __dirname is under .next/server/, so walk up to project root
const PROJECT_ROOT = path.resolve(process.cwd(), '..');

export const DB_PATH = process.env.DB_PATH || path.join(PROJECT_ROOT, 'data', 'xianyu.db');
export const COOKIE_PATH = process.env.COOKIE_PATH || path.join(PROJECT_ROOT, 'auth', 'cookies.json');
export const KEYWORDS_FILE = process.env.KEYWORDS_FILE || path.join(PROJECT_ROOT, 'keywords.json');
export const DEBUG_DIR = process.env.DEBUG_DIR || path.join(PROJECT_ROOT, 'data', 'debug');

export const SEARCH_URL_TEMPLATE = 'https://www.goofish.com/search?q={keyword}';
export const CRAWL_INTERVAL_MINUTES = 5;
export const SCROLL_COUNT = 3;
export const RANDOM_DELAY_MIN = 2.0;
export const RANDOM_DELAY_MAX = 5.0;
export const PAGE_LOAD_TIMEOUT = 30000;
export const BROWSER_LAUNCH_TIMEOUT = 30000;
export const HEADLESS = true;
export const PER_PAGE = 20;
export const MAX_HISTORY_ROUNDS = 5;

export const DEFAULT_KEYWORDS: KeywordEntry[] = [
  { keyword: 'DDR5内存', category: '内存' },
  { keyword: 'DDR5 16G', category: '内存' },
  { keyword: 'DDR5 32G', category: '内存' },
  { keyword: 'DDR5 48G', category: '内存' },
];

// Browser config (hardcoded in spider.py, extracted here)
export const BROWSER_VIEWPORT = { width: 1920, height: 1080 };
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const BROWSER_LOCALE = 'zh-CN';
export const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
];

// Login config
export const LOGIN_WAIT_TIMEOUT = 300; // seconds
export const LOGIN_RECHECK_INTERVAL = 30; // seconds

// Crawl timing
export const POST_NAVIGATION_SLEEP = 3; // seconds
export const INTER_KEYWORD_DELAY_MIN = 5; // seconds
export const INTER_KEYWORD_DELAY_MAX = 10; // seconds

/**
 * Load keywords from keywords.json.
 * Backward-compatible with plain string arrays.
 */
export function loadKeywords(): KeywordEntry[] {
  try {
    if (!fs.existsSync(KEYWORDS_FILE)) {
      return [...DEFAULT_KEYWORDS];
    }
    const raw = fs.readFileSync(KEYWORDS_FILE, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data) || data.length === 0) {
      return [...DEFAULT_KEYWORDS];
    }

    // Normalize: support both plain string arrays and {keyword, category} arrays
    return data.map((item: string | KeywordEntry) => {
      if (typeof item === 'string') {
        return { keyword: item, category: '' };
      }
      return {
        keyword: String(item.keyword || ''),
        category: String(item.category || ''),
      };
    }).filter((item: KeywordEntry) => item.keyword.trim() !== '');
  } catch {
    return [...DEFAULT_KEYWORDS];
  }
}

/**
 * Persist keywords to keywords.json.
 */
export function saveKeywords(keywords: KeywordEntry[]): void {
  const dir = path.dirname(KEYWORDS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const normalized = keywords.map(kw => ({
    keyword: kw.keyword.trim(),
    category: kw.category.trim(),
  })).filter(kw => kw.keyword !== '');

  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
}

/**
 * Get a map of keyword → category.
 */
export function getKeywordCategoryMap(): Record<string, string> {
  const keywords = loadKeywords();
  const map: Record<string, string> = {};
  for (const kw of keywords) {
    if (kw.keyword) {
      map[kw.keyword] = kw.category || '';
    }
  }
  return map;
}

/**
 * Get all unique non-empty categories from keywords.
 */
export function getAllCategoriesFromKeywords(): string[] {
  const keywords = loadKeywords();
  const cats = new Set(keywords.map(kw => kw.category).filter(Boolean));
  return [...cats].sort();
}

/**
 * Check if cookies file exists.
 */
export function hasCookies(): boolean {
  try {
    return fs.existsSync(COOKIE_PATH);
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists.
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
