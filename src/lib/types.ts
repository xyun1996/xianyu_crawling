// Ported from models.py

export interface Product {
  id: number | null;
  item_id: string;
  title: string;
  price: number;
  seller_name: string;
  location: string;
  condition: string;
  image_url: string;
  search_keyword: string;
  category: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  is_active: boolean;
}

export interface PriceSnapshot {
  id: number | null;
  product_id: number;
  price: number;
  captured_at: string | null;
}

export interface CrawlResult {
  keyword: string;
  total_items: number;
  new_items: number;
  price_changes: number;
  errors: number;
}

export interface CrawlDetail {
  keyword: string;
  items: CrawledItem[];
}

export interface CrawledItem {
  title: string;
  price: number;
  first_seen_at: string;
  is_new: boolean;
  price_change: number | null;
  keyword: string;
}

export interface KeywordEntry {
  keyword: string;
  category: string;
}

export interface CrawlStatus {
  running: boolean;
  paused: boolean;
  crawling_now: boolean;
  interval: number;
  keywords: KeywordEntry[];
  last_crawl_time: string | null;
  last_crawl_summary: string | null;
  next_crawl_time: string | null;
  max_rounds: number | null;
  completed_rounds: number;
  crawl_history: CrawlHistoryEntry[];
  has_cookies: boolean;
  login_in_progress: boolean;
  current_keyword: string | null;
  current_keyword_index: number;
  current_round_items: CrawledItem[];
  selected_keywords: KeywordEntry[];
  last_round_keywords: KeywordEntry[];
  active_crawl_keyword_count: number;
}

export interface CrawlHistoryEntry {
  time: string;
  round: number;
  items: CrawledItem[];
}

// Database query result types

export interface ProductWithHistory extends Product {
  history: PriceSnapshot[];
  min_price: number;
  max_price: number;
  snap_count: number;
}

export interface Stats {
  total_products: number;
  active_products: number;
  total_snapshots: number;
  by_keyword: Record<string, number>;
}

export interface PriceSummary {
  [keyword: string]: {
    min: number;
    max: number;
    avg: number;
    count: number;
  };
}

export interface CategoryStat {
  min: number;
  max: number;
  avg: number;
  count: number;
  keywords: string[];
}

export type CategoryStats = Record<string, CategoryStat>;
