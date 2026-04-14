/**
 * File-based cache utilities for the catalog.
 *
 * Cache is stored in `.cache/` relative to the plugin directory.
 */

import fs from "node:fs";
import path from "node:path";
import type { Catalog } from "./types.js";

const CACHE_DIR = ".cache";
const CATALOG_FILE = "catalog.json";
const TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL

function getCacheDir(baseDir: string): string {
  return path.join(baseDir, CACHE_DIR);
}

function getCatalogPath(baseDir: string): string {
  return path.join(getCacheDir(baseDir), CATALOG_FILE);
}

/**
 * Ensure the cache directory exists.
 */
function ensureCacheDir(baseDir: string): void {
  const dir = getCacheDir(baseDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read the cached catalog. Returns null if not cached or expired.
 */
export function readCache(baseDir: string): Catalog | null {
  const catalogPath = getCatalogPath(baseDir);
  if (!fs.existsSync(catalogPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(catalogPath, "utf-8");
    const catalog: Catalog = JSON.parse(raw);

    // Check TTL
    const fetchedAt = new Date(catalog.fetchedAt).getTime();
    if (Date.now() - fetchedAt > TTL_MS) {
      return null; // expired
    }

    return catalog;
  } catch {
    return null;
  }
}

/**
 * Write the catalog to cache.
 */
export function writeCache(baseDir: string, catalog: Catalog): void {
  ensureCacheDir(baseDir);
  const catalogPath = getCatalogPath(baseDir);
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
}

/**
 * Clear the cache.
 */
export function clearCache(baseDir: string): void {
  const catalogPath = getCatalogPath(baseDir);
  if (fs.existsSync(catalogPath)) {
    fs.unlinkSync(catalogPath);
  }
}