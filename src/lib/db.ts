// Ported from database.py

import Database from 'better-sqlite3';
import { DB_PATH, PER_PAGE, ensureDir } from './config';
import type { Product, PriceSnapshot, ProductWithHistory, Stats, PriceSummary, CategoryStats } from './types';

let _db: Database.Database | null = null;

function ensureDbDir(): void {
  const dir = DB_PATH.substring(0, DB_PATH.replace(/[/\\]/g, '/').lastIndexOf('/'));
  if (dir) ensureDir(dir);
}

/**
 * Get a persistent database connection (singleton).
 * better-sqlite3 is synchronous and single-threaded, so one connection is safe.
 */
export function getDb(): Database.Database {
  if (!_db) {
    ensureDbDir();
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

/**
 * Initialize database tables and run migrations.
 */
export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      seller_name TEXT DEFAULT '',
      location TEXT DEFAULT '',
      condition TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      search_keyword TEXT DEFAULT '',
      category TEXT DEFAULT '',
      first_seen_at DATETIME NOT NULL,
      last_seen_at DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_products_item_id ON products(item_id);
    CREATE INDEX IF NOT EXISTS idx_products_keyword ON products(search_keyword);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      price REAL NOT NULL,
      captured_at DATETIME NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_product ON price_snapshots(product_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_captured ON price_snapshots(captured_at);
  `);

  // Migration: add category column to existing databases
  try {
    db.exec("ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''");
  } catch {
    // Column already exists, ignore
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)");
  } catch {
    // Index already exists, ignore
  }
}

/**
 * Insert or update a product. Returns { product, isNew, priceChanged }.
 */
export function upsertProduct(
  product: Product,
  category: string = ''
): { product: Product; isNew: boolean; priceChanged: boolean } {
  const db = getDb();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const existing = db.prepare('SELECT id, price FROM products WHERE item_id = ?').get(product.item_id) as
    | { id: number; price: number }
    | undefined;

  if (!existing) {
    // New product
    const firstSeen = now;
    const lastSeen = now;
    const info = db
      .prepare(
        `INSERT INTO products
         (item_id, title, price, seller_name, location, condition,
          image_url, search_keyword, category, first_seen_at, last_seen_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(
        product.item_id,
        product.title,
        product.price,
        product.seller_name,
        product.location,
        product.condition,
        product.image_url,
        product.search_keyword,
        category,
        firstSeen,
        lastSeen
      );

    return {
      product: {
        ...product,
        id: info.lastInsertRowid as number,
        category,
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        is_active: true,
      },
      isNew: true,
      priceChanged: false,
    };
  }

  // Existing product — update info
  const priceChanged = Math.abs(product.price - existing.price) > 0.01;

  db.prepare(
    `UPDATE products
     SET title = ?, price = ?, seller_name = ?, location = ?,
         condition = ?, image_url = ?, search_keyword = ?,
         category = ?, last_seen_at = ?, is_active = 1
     WHERE id = ?`
  ).run(
    product.title,
    product.price,
    product.seller_name,
    product.location,
    product.condition,
    product.image_url,
    product.search_keyword,
    category,
    now,
    existing.id
  );

  return {
    product: {
      ...product,
      id: existing.id,
      category,
      first_seen_at: now,
      last_seen_at: now,
      is_active: true,
    },
    isNew: false,
    priceChanged,
  };
}

/**
 * Record a price snapshot.
 */
export function addPriceSnapshot(product_id: number, price: number): void {
  const db = getDb();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare('INSERT INTO price_snapshots (product_id, price, captured_at) VALUES (?, ?, ?)').run(
    product_id,
    price,
    now
  );
}

/**
 * Mark products as inactive if they were not found in the latest crawl.
 */
export function markInactiveProducts(activeItemIds: Set<string>, keyword: string): void {
  if (activeItemIds.size === 0) return;
  const db = getDb();
  const placeholders = Array.from({ length: activeItemIds.size }, () => '?').join(',');
  const params = [keyword, ...activeItemIds];
  db.prepare(
    `UPDATE products SET is_active = 0
     WHERE search_keyword = ? AND is_active = 1
     AND item_id NOT IN (${placeholders})`
  ).run(...params);
}

/**
 * Get latest products, optionally filtered by keyword.
 */
export function getLatestProducts(keyword: string = '', limit: number = 20): Product[] {
  const db = getDb();
  let rows: any[];
  if (keyword) {
    rows = db
      .prepare(
        `SELECT * FROM products
         WHERE search_keyword = ? AND is_active = 1
         ORDER BY last_seen_at DESC LIMIT ?`
      )
      .all(keyword, limit);
  } else {
    rows = db
      .prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY last_seen_at DESC LIMIT ?')
      .all(limit);
  }
  return rows as Product[];
}

/**
 * Get price history for a product.
 */
export function getPriceHistory(product_id: number): PriceSnapshot[] {
  const db = getDb();
  return db
    .prepare('SELECT price, captured_at FROM price_snapshots WHERE product_id = ? ORDER BY captured_at ASC')
    .all(product_id) as PriceSnapshot[];
}

/**
 * Get products with price history (deduplicated — only keeps price change points).
 */
export function getProductsWithPriceHistory(keyword: string = '', limit: number = 20): ProductWithHistory[] {
  const db = getDb();

  let rows: any[];
  if (keyword) {
    rows = db
      .prepare(
        `SELECT p.id, p.title, p.price, p.location, p.search_keyword, p.category,
                p.first_seen_at, p.last_seen_at, p.is_active,
                COUNT(s.id) as snap_count,
                MIN(s.price) as min_price,
                MAX(s.price) as max_price
         FROM products p
         JOIN price_snapshots s ON p.id = s.product_id
         WHERE p.search_keyword = ?
         GROUP BY p.id
         HAVING snap_count > 1
         ORDER BY (max_price - min_price) DESC
         LIMIT ?`
      )
      .all(keyword, limit);
  } else {
    rows = db
      .prepare(
        `SELECT p.id, p.title, p.price, p.location, p.search_keyword, p.category,
                p.first_seen_at, p.last_seen_at, p.is_active,
                COUNT(s.id) as snap_count,
                MIN(s.price) as min_price,
                MAX(s.price) as max_price
         FROM products p
         JOIN price_snapshots s ON p.id = s.product_id
         GROUP BY p.id
         HAVING snap_count > 1
         ORDER BY (max_price - min_price) DESC
         LIMIT ?`
      )
      .all(limit);
  }

  return rows.map((r: any) => {
    // Get detailed price history for this product
    const snaps = db
      .prepare('SELECT price, captured_at FROM price_snapshots WHERE product_id = ? ORDER BY captured_at ASC')
      .all(r.id) as { price: number; captured_at: string }[];

    // Deduplicate: only keep entries where price changed from the previous entry
    const history: { price: number; captured_at: string }[] = [];
    let lastPrice: number | null = null;
    for (const s of snaps) {
      if (lastPrice === null || Math.abs(s.price - lastPrice) > 0.01) {
        history.push({ price: s.price, captured_at: s.captured_at });
        lastPrice = s.price;
      }
    }

    return {
      ...r,
      history,
    } as ProductWithHistory;
  });
}

/**
 * Get the last price snapshot before the current one for a product.
 */
export function getLastPriceBefore(product_id: number): number | null {
  const db = getDb();
  const row = db
    .prepare('SELECT price FROM price_snapshots WHERE product_id = ? ORDER BY captured_at DESC LIMIT 1 OFFSET 1')
    .get(product_id) as { price: number } | undefined;
  return row ? row.price : null;
}

/**
 * Get database statistics.
 */
export function getStats(): Stats {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count;
  const active = (db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get() as any).count;
  const snapshots = (db.prepare('SELECT COUNT(*) as count FROM price_snapshots').get() as any).count;
  const keywords = db
    .prepare(
      'SELECT search_keyword, COUNT(*) as cnt FROM products WHERE is_active = 1 GROUP BY search_keyword'
    )
    .all() as { search_keyword: string; cnt: number }[];

  return {
    total_products: total,
    active_products: active,
    total_snapshots: snapshots,
    by_keyword: Object.fromEntries(keywords.map(r => [r.search_keyword, r.cnt])),
  };
}

/**
 * Get paginated product list with filtering and sorting.
 */
export function getProductsPaginated(
  keyword: string = '',
  category: string = '',
  activeOnly: boolean = true,
  sortBy: string = 'last_seen_at',
  sortOrder: string = 'desc',
  page: number = 1,
  perPage: number = PER_PAGE
): { products: Product[]; totalCount: number } {
  const db = getDb();

  // Build WHERE conditions
  const conditions: string[] = [];
  const params: any[] = [];

  if (keyword) {
    conditions.push('search_keyword = ?');
    params.push(keyword);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (activeOnly) {
    conditions.push('is_active = 1');
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  // Count total
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM products${whereClause}`).get(...params) as any;
  const totalCount = countRow.count;

  // Sort whitelist (prevent SQL injection)
  const validSorts = new Set(['last_seen_at', 'price', 'first_seen_at', 'title']);
  if (!validSorts.has(sortBy)) sortBy = 'last_seen_at';
  if (sortOrder !== 'asc' && sortOrder !== 'desc') sortOrder = 'desc';

  // Paginated query
  const offset = (page - 1) * perPage;
  const rows = db
    .prepare(`SELECT * FROM products${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`)
    .all(...params, perPage, offset) as Product[];

  return { products: rows, totalCount };
}

/**
 * Get a single product by ID.
 */
export function getProductById(product_id: number): Product | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  return (row as Product) || null;
}

/**
 * Get price summary grouped by keyword.
 */
export function getPriceSummary(keyword: string = ''): PriceSummary {
  const db = getDb();

  let rows: any[];
  if (keyword) {
    rows = db
      .prepare(
        `SELECT search_keyword,
                MIN(price) as min_price,
                MAX(price) as max_price,
                ROUND(AVG(price), 2) as avg_price,
                COUNT(*) as count
         FROM products WHERE is_active = 1 AND search_keyword = ?
         GROUP BY search_keyword`
      )
      .all(keyword);
  } else {
    rows = db
      .prepare(
        `SELECT search_keyword,
                MIN(price) as min_price,
                MAX(price) as max_price,
                ROUND(AVG(price), 2) as avg_price,
                COUNT(*) as count
         FROM products WHERE is_active = 1
         GROUP BY search_keyword`
      )
      .all();
  }

  const result: PriceSummary = {};
  for (const r of rows) {
    result[r.search_keyword] = {
      min: r.min_price,
      max: r.max_price,
      avg: r.avg_price,
      count: r.count,
    };
  }
  return result;
}

/**
 * Get statistics grouped by category.
 */
export function getStatsByCategory(): CategoryStats {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT category,
              MIN(price) as min_price,
              MAX(price) as max_price,
              ROUND(AVG(price), 2) as avg_price,
              COUNT(*) as count
       FROM products WHERE is_active = 1 AND category != ''
       GROUP BY category`
    )
    .all() as any[];

  // Get keyword lists per category
  const kwRows = db
    .prepare(
      `SELECT category, search_keyword, COUNT(*) as cnt
       FROM products WHERE is_active = 1 AND category != ''
       GROUP BY category, search_keyword`
    )
    .all() as { category: string; search_keyword: string; cnt: number }[];

  const categoryKeywords: Record<string, string[]> = {};
  for (const r of kwRows) {
    if (!categoryKeywords[r.category]) categoryKeywords[r.category] = [];
    categoryKeywords[r.category].push(r.search_keyword);
  }

  const result: CategoryStats = {};
  for (const r of rows) {
    result[r.category] = {
      min: r.min_price,
      max: r.max_price,
      avg: r.avg_price,
      count: r.count,
      keywords: categoryKeywords[r.category] || [],
    };
  }

  // Uncategorized products
  const uncategorized = db
    .prepare(
      `SELECT COUNT(*) as count,
              MIN(price) as min_price,
              MAX(price) as max_price,
              ROUND(AVG(price), 2) as avg_price
       FROM products WHERE is_active = 1 AND (category IS NULL OR category = '')`
    )
    .get() as any;

  if (uncategorized && uncategorized.count > 0) {
    result[''] = {
      min: uncategorized.min_price,
      max: uncategorized.max_price,
      avg: uncategorized.avg_price,
      count: uncategorized.count,
      keywords: [],
    };
  }

  return result;
}

/**
 * Get all non-empty categories.
 */
export function getAllCategories(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT DISTINCT category FROM products WHERE category != '' ORDER BY category")
    .all() as { category: string }[];
  return rows.map(r => r.category);
}

// ── Export helpers ──────────────────────────────────────────────────────

/**
 * Get all matching products (no pagination) with their price snapshots for CSV export.
 */
export function getProductsForExport(
  keyword: string = '',
  category: string = '',
  activeOnly: boolean = true
): (Product & { snapshots: PriceSnapshot[] })[] {
  const db = getDb();

  const conditions: string[] = [];
  const params: any[] = [];

  if (keyword) {
    conditions.push('search_keyword = ?');
    params.push(keyword);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (activeOnly) {
    conditions.push('is_active = 1');
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const products = db
    .prepare(`SELECT * FROM products${whereClause} ORDER BY last_seen_at DESC`)
    .all(...params) as Product[];

  const snapStmt = db.prepare(
    'SELECT * FROM price_snapshots WHERE product_id = ? ORDER BY captured_at ASC'
  );

  return products.map(p => ({
    ...p,
    snapshots: snapStmt.all(p.id) as PriceSnapshot[],
  }));
}

// ── Delete helpers ──────────────────────────────────────────────────────

/**
 * Delete a single product and its price snapshots.
 */
export function deleteProduct(id: number): { deleted_products: number; deleted_snapshots: number } {
  const db = getDb();
  return db.transaction(() => {
    const snapResult = db.prepare('DELETE FROM price_snapshots WHERE product_id = ?').run(id);
    const prodResult = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return {
      deleted_products: prodResult.changes,
      deleted_snapshots: snapResult.changes,
    };
  })();
}

/**
 * Delete multiple products and their price snapshots by IDs.
 */
export function deleteProducts(ids: number[]): { deleted_products: number; deleted_snapshots: number } {
  if (ids.length === 0) return { deleted_products: 0, deleted_snapshots: 0 };
  const db = getDb();
  return db.transaction(() => {
    const placeholders = ids.map(() => '?').join(',');
    const snapResult = db
      .prepare(`DELETE FROM price_snapshots WHERE product_id IN (${placeholders})`)
      .run(...ids);
    const prodResult = db
      .prepare(`DELETE FROM products WHERE id IN (${placeholders})`)
      .run(...ids);
    return {
      deleted_products: prodResult.changes,
      deleted_snapshots: snapResult.changes,
    };
  })();
}

/**
 * Delete all products matching a keyword and their price snapshots.
 */
export function deleteProductsByKeyword(keyword: string): { deleted_products: number; deleted_snapshots: number } {
  const db = getDb();
  return db.transaction(() => {
    const ids = db
      .prepare('SELECT id FROM products WHERE search_keyword = ?')
      .all(keyword) as { id: number }[];
    if (ids.length === 0) return { deleted_products: 0, deleted_snapshots: 0 };
    const idList = ids.map(r => r.id);
    const placeholders = idList.map(() => '?').join(',');
    const snapResult = db
      .prepare(`DELETE FROM price_snapshots WHERE product_id IN (${placeholders})`)
      .run(...idList);
    const prodResult = db
      .prepare('DELETE FROM products WHERE search_keyword = ?')
      .run(keyword);
    return {
      deleted_products: prodResult.changes,
      deleted_snapshots: snapResult.changes,
    };
  })();
}

/**
 * Delete all products matching a category and their price snapshots.
 */
export function deleteProductsByCategory(category: string): { deleted_products: number; deleted_snapshots: number } {
  const db = getDb();
  return db.transaction(() => {
    const ids = db
      .prepare('SELECT id FROM products WHERE category = ?')
      .all(category) as { id: number }[];
    if (ids.length === 0) return { deleted_products: 0, deleted_snapshots: 0 };
    const idList = ids.map(r => r.id);
    const placeholders = idList.map(() => '?').join(',');
    const snapResult = db
      .prepare(`DELETE FROM price_snapshots WHERE product_id IN (${placeholders})`)
      .run(...idList);
    const prodResult = db
      .prepare('DELETE FROM products WHERE category = ?')
      .run(category);
    return {
      deleted_products: prodResult.changes,
      deleted_snapshots: snapResult.changes,
    };
  })();
}

/**
 * Delete all products and price snapshots.
 */
export function deleteAllProducts(): { deleted_products: number; deleted_snapshots: number } {
  const db = getDb();
  return db.transaction(() => {
    const snapResult = db.prepare('DELETE FROM price_snapshots').run();
    const prodResult = db.prepare('DELETE FROM products').run();
    return {
      deleted_products: prodResult.changes,
      deleted_snapshots: snapResult.changes,
    };
  })();
}

/**
 * Count products and snapshots matching a filter (for delete preview).
 */
export function countProductsForDelete(
  mode: 'by_keyword' | 'by_category',
  value: string
): { product_count: number; snapshot_count: number } {
  const db = getDb();
  const col = mode === 'by_keyword' ? 'search_keyword' : 'category';
  const productCount = (
    db.prepare(`SELECT COUNT(*) as count FROM products WHERE ${col} = ?`).get(value) as any
  ).count;
  const snapshotCount = (
    db.prepare(
      `SELECT COUNT(*) as count FROM price_snapshots WHERE product_id IN (SELECT id FROM products WHERE ${col} = ?)`
    ).get(value) as any
  ).count;
  return { product_count: productCount, snapshot_count: snapshotCount };
}

/**
 * Count all products and snapshots (for clear_all preview).
 */
export function countAllForDelete(): { product_count: number; snapshot_count: number } {
  const db = getDb();
  return {
    product_count: (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count,
    snapshot_count: (db.prepare('SELECT COUNT(*) as count FROM price_snapshots').get() as any).count,
  };
}
