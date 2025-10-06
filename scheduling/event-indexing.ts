/**
 * Event indexing and query optimization system
 * Provides efficient event storage, retrieval, and query performance
 * Optimized for Jetson Nano Orin hardware constraints
 */

import { CalendarEvent } from '../calendar/types';

export interface EventIndex {
  id: string;
  eventId: string;
  startTime: Date;
  endTime: Date;
  userId: string;
  category: string;
  priority: number;
  searchTerms: string[];
  lastAccessed: Date;
}

export interface IndexStats {
  totalEvents: number;
  indexSize: number;
  hitRate: number;
  missRate: number;
  averageQueryTime: number;
  lastOptimization: Date;
  fragmentationLevel: number;
}

export interface QueryOptions {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  category?: string;
  priority?: number;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface QueryResult<T> {
  items: T[];
  totalCount: number;
  queryTime: number;
  fromCache: boolean;
  indexHit: boolean;
}

export class EventIndexingSystem {
  private primaryIndex: Map<string, EventIndex> = new Map();
  private timeIndex: Map<string, Set<string>> = new Map(); // Date key -> Event IDs
  private userIndex: Map<string, Set<string>> = new Map(); // User ID -> Event IDs
  private categoryIndex: Map<string, Set<string>> = new Map(); // Category -> Event IDs
  private searchIndex: Map<string, Set<string>> = new Map(); // Search term -> Event IDs
  private queryCache: Map<string, { result: any; timestamp: Date; accessCount: number }> = new Map();
  private stats: IndexStats;
  private maxCacheSize = 1000; // Limit cache size for memory efficiency
  private cacheExpiryMs = 300000; // 5 minutes cache expiry

  constructor() {
    this.stats = {
      totalEvents: 0,
      indexSize: 0,
      hitRate: 0,
      missRate: 0,
      averageQueryTime: 0,
      lastOptimization: new Date(),
      fragmentationLevel: 0
    };
  }

  /**
   * Add or update event in the index
   */
  public indexEvent(event: CalendarEvent): void {
    const startTime = performance.now();
    
    try {
      // Remove existing index if updating
      if (this.primaryIndex.has(event.id)) {
        this.removeFromSecondaryIndexes(event.id);
      }

      // Create index entry
      const indexEntry: EventIndex = {
        id: `idx_${event.id}`,
        eventId: event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        userId: event.createdBy,
        category: event.category,
        priority: this.getPriorityValue(event.priority),
        searchTerms: this.extractSearchTerms(event),
        lastAccessed: new Date()
      };

      // Add to primary index
      this.primaryIndex.set(event.id, indexEntry);

      // Add to secondary indexes
      this.addToTimeIndex(event);
      this.addToUserIndex(event);
      this.addToCategoryIndex(event);
      this.addToSearchIndex(event);

      // Update stats
      this.stats.totalEvents = this.primaryIndex.size;
      this.updateIndexSize();
      
      // Clear related cache entries
      this.invalidateRelatedCache(event);

    } finally {
      const duration = performance.now() - startTime;
      this.updateQueryStats(duration, false);
    }
  }

  /**
   * Remove event from all indexes
   */
  public removeEvent(eventId: string): void {
    const indexEntry = this.primaryIndex.get(eventId);
    if (!indexEntry) {
      return;
    }

    // Remove from all indexes
    this.primaryIndex.delete(eventId);
    this.removeFromSecondaryIndexes(eventId);
    
    // Update stats
    this.stats.totalEvents = this.primaryIndex.size;
    this.updateIndexSize();
    
    // Clear cache
    this.clearCache();
  }

  /**
   * Query events with optimization
   */
  public queryEvents(options: QueryOptions): QueryResult<string> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      const duration = performance.now() - startTime;
      this.updateQueryStats(duration, true);
      return {
        ...cached.result,
        queryTime: duration,
        fromCache: true,
        indexHit: true
      };
    }

    try {
      let candidateIds = new Set<string>();
      let indexUsed = false;

      // Use most selective index first
      if (options.userId) {
        candidateIds = this.userIndex.get(options.userId) || new Set();
        indexUsed = true;
      } else if (options.category) {
        candidateIds = this.categoryIndex.get(options.category) || new Set();
        indexUsed = true;
      } else if (options.startDate || options.endDate) {
        candidateIds = this.queryTimeIndex(options.startDate, options.endDate);
        indexUsed = true;
      } else {
        // Full scan fallback
        candidateIds = new Set(this.primaryIndex.keys());
      }

      // Apply additional filters
      const filteredIds = this.applyFilters(candidateIds, options);
      
      // Apply pagination
      const paginatedIds = this.applyPagination(filteredIds, options);
      
      const result: QueryResult<string> = {
        items: paginatedIds,
        totalCount: filteredIds.length,
        queryTime: 0,
        fromCache: false,
        indexHit: indexUsed
      };

      // Cache the result
      this.addToCache(cacheKey, result);
      
      const duration = performance.now() - startTime;
      result.queryTime = duration;
      this.updateQueryStats(duration, false);
      
      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.updateQueryStats(duration, false);
      throw error;
    }
  }

  /**
   * Search events by text
   */
  public searchEvents(searchTerm: string, options?: Omit<QueryOptions, 'searchTerm'>): QueryResult<string> {
    const normalizedTerm = searchTerm.toLowerCase().trim();
    const searchOptions: QueryOptions = { ...options, searchTerm: normalizedTerm };
    
    return this.queryEvents(searchOptions);
  }

  /**
   * Optimize indexes for better performance
   */
  public optimizeIndexes(): void {
    const startTime = performance.now();
    
    try {
      // Remove stale cache entries
      this.cleanupCache();
      
      // Rebuild fragmented indexes
      this.rebuildFragmentedIndexes();
      
      // Optimize search index
      this.optimizeSearchIndex();
      
      // Update stats
      this.stats.lastOptimization = new Date();
      this.stats.fragmentationLevel = this.calculateFragmentation();
      
    } finally {
      const duration = performance.now() - startTime;
      console.log(`Index optimization completed in ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get current index statistics
   */
  public getStats(): IndexStats {
    this.updateIndexSize();
    return { ...this.stats };
  }

  /**
   * Clear all indexes and cache
   */
  public clear(): void {
    this.primaryIndex.clear();
    this.timeIndex.clear();
    this.userIndex.clear();
    this.categoryIndex.clear();
    this.searchIndex.clear();
    this.queryCache.clear();
    
    this.stats = {
      totalEvents: 0,
      indexSize: 0,
      hitRate: 0,
      missRate: 0,
      averageQueryTime: 0,
      lastOptimization: new Date(),
      fragmentationLevel: 0
    };
  }

  private extractSearchTerms(event: CalendarEvent): string[] {
    const terms: string[] = [];
    
    // Add title words
    if (event.title) {
      terms.push(...event.title.toLowerCase().split(/\s+/));
    }
    
    // Add description words
    if (event.description) {
      terms.push(...event.description.toLowerCase().split(/\s+/));
    }
    
    // Add location words
    if (event.location) {
      if (event.location.name) {
        terms.push(...event.location.name.toLowerCase().split(/\s+/));
      }
      if (event.location.address) {
        terms.push(...event.location.address.toLowerCase().split(/\s+/));
      }
    }
    
    // Filter out common words and short terms
    return terms.filter(term => term.length > 2 && !this.isStopWord(term));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return stopWords.has(word);
  }

  private getPriorityValue(priority: any): number {
    // Convert priority to numeric value for indexing
    if (typeof priority === 'number') return priority;
    if (typeof priority === 'string') {
      switch (priority.toLowerCase()) {
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
        default: return 0;
      }
    }
    return 0;
  }

  private addToTimeIndex(event: CalendarEvent): void {
    const dateKey = event.startTime.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!this.timeIndex.has(dateKey)) {
      this.timeIndex.set(dateKey, new Set());
    }
    this.timeIndex.get(dateKey)!.add(event.id);
  }

  private addToUserIndex(event: CalendarEvent): void {
    if (!this.userIndex.has(event.createdBy)) {
      this.userIndex.set(event.createdBy, new Set());
    }
    this.userIndex.get(event.createdBy)!.add(event.id);
  }

  private addToCategoryIndex(event: CalendarEvent): void {
    if (!this.categoryIndex.has(event.category)) {
      this.categoryIndex.set(event.category, new Set());
    }
    this.categoryIndex.get(event.category)!.add(event.id);
  }

  private addToSearchIndex(event: CalendarEvent): void {
    const indexEntry = this.primaryIndex.get(event.id);
    if (indexEntry) {
      indexEntry.searchTerms.forEach(term => {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term)!.add(event.id);
      });
    }
  }

  private removeFromSecondaryIndexes(eventId: string): void {
    const indexEntry = this.primaryIndex.get(eventId);
    if (!indexEntry) return;

    // Remove from time index
    const dateKey = indexEntry.startTime.toISOString().split('T')[0];
    this.timeIndex.get(dateKey)?.delete(eventId);

    // Remove from user index
    this.userIndex.get(indexEntry.userId)?.delete(eventId);

    // Remove from category index
    this.categoryIndex.get(indexEntry.category)?.delete(eventId);

    // Remove from search index
    indexEntry.searchTerms.forEach(term => {
      this.searchIndex.get(term)?.delete(eventId);
    });
  }

  private queryTimeIndex(startDate?: Date, endDate?: Date): Set<string> {
    const result = new Set<string>();
    
    if (!startDate && !endDate) {
      return result;
    }

    const start = startDate || new Date(0);
    const end = endDate || new Date();

    for (const entry of Array.from(this.timeIndex.entries())) {
      const [dateKey, eventIds] = entry;
      const indexDate = new Date(dateKey);
      if (indexDate >= start && indexDate <= end) {
        eventIds.forEach(id => result.add(id));
      }
    }

    return result;
  }

  private applyFilters(candidateIds: Set<string>, options: QueryOptions): string[] {
    const filtered: string[] = [];

    for (const eventId of Array.from(candidateIds)) {
      const indexEntry = this.primaryIndex.get(eventId);
      if (!indexEntry) continue;

      // Apply filters
      if (options.userId && indexEntry.userId !== options.userId) continue;
      if (options.category && indexEntry.category !== options.category) continue;
      if (options.priority && indexEntry.priority !== options.priority) continue;
      
      if (options.startDate && indexEntry.endTime < options.startDate) continue;
      if (options.endDate && indexEntry.startTime > options.endDate) continue;
      
      if (options.searchTerm) {
        const hasSearchTerm = indexEntry.searchTerms.some(term => 
          term.includes(options.searchTerm!.toLowerCase())
        );
        if (!hasSearchTerm) continue;
      }

      filtered.push(eventId);
    }

    return filtered;
  }

  private applyPagination(items: string[], options: QueryOptions): string[] {
    const limit = options.limit || items.length;
    const offset = options.offset || 0;
    
    return items.slice(offset, offset + limit);
  }

  private generateCacheKey(options: QueryOptions): string {
    return JSON.stringify(options);
  }

  private getFromCache(key: string): { result: any; timestamp: Date; accessCount: number } | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp.getTime() > this.cacheExpiryMs) {
      this.queryCache.delete(key);
      return null;
    }

    // Update access count
    cached.accessCount++;
    return cached;
  }

  private addToCache(key: string, result: any): void {
    // Limit cache size
    if (this.queryCache.size >= this.maxCacheSize) {
      this.evictLeastUsedCache();
    }

    this.queryCache.set(key, {
      result: { ...result },
      timestamp: new Date(),
      accessCount: 1
    });
  }

  private evictLeastUsedCache(): void {
    let leastUsedKey = '';
    let leastAccessCount = Infinity;

    for (const entry of Array.from(this.queryCache.entries())) {
      const [key, cached] = entry;
      if (cached.accessCount < leastAccessCount) {
        leastAccessCount = cached.accessCount;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.queryCache.delete(leastUsedKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const entry of Array.from(this.queryCache.entries())) {
      const [key, cached] = entry;
      if (now - cached.timestamp.getTime() > this.cacheExpiryMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  private invalidateRelatedCache(event: CalendarEvent): void {
    const keysToDelete: string[] = [];
    
    for (const key of Array.from(this.queryCache.keys())) {
      const options = JSON.parse(key) as QueryOptions;
      
      // Invalidate if query could be affected by this event
      if (
        !options.userId || options.userId === event.createdBy ||
        !options.category || options.category === event.category ||
        this.dateRangeOverlaps(options, event)
      ) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.queryCache.delete(key));
  }

  private dateRangeOverlaps(options: QueryOptions, event: CalendarEvent): boolean {
    if (!options.startDate && !options.endDate) return true;
    
    const queryStart = options.startDate || new Date(0);
    const queryEnd = options.endDate || new Date();
    
    return !(event.endTime < queryStart || event.startTime > queryEnd);
  }

  private clearCache(): void {
    this.queryCache.clear();
  }

  private updateIndexSize(): void {
    this.stats.indexSize = 
      this.primaryIndex.size +
      this.timeIndex.size +
      this.userIndex.size +
      this.categoryIndex.size +
      this.searchIndex.size +
      this.queryCache.size;
  }

  private updateQueryStats(duration: number, fromCache: boolean): void {
    if (fromCache) {
      this.stats.hitRate = (this.stats.hitRate + 1) / 2; // Simple moving average
    } else {
      this.stats.missRate = (this.stats.missRate + 1) / 2;
    }
    
    this.stats.averageQueryTime = (this.stats.averageQueryTime + duration) / 2;
  }

  private rebuildFragmentedIndexes(): void {
    // Rebuild indexes that have become fragmented
    // This is a simplified implementation
    if (this.stats.fragmentationLevel > 0.3) {
      const events = Array.from(this.primaryIndex.values());
      this.clear();
      
      // Re-index all events
      events.forEach(indexEntry => {
        // This would need the original event data in a real implementation
        // For now, we'll just rebuild the index structure
      });
    }
  }

  private optimizeSearchIndex(): void {
    // Remove search terms that are no longer referenced
    for (const entry of Array.from(this.searchIndex.entries())) {
      const [term, eventIds] = entry;
      if (eventIds.size === 0) {
        this.searchIndex.delete(term);
      }
    }
  }

  private calculateFragmentation(): number {
    // Simple fragmentation calculation based on empty sets in indexes
    let emptyIndexes = 0;
    let totalIndexes = 0;

    [this.timeIndex, this.userIndex, this.categoryIndex, this.searchIndex].forEach(index => {
      for (const entry of Array.from(index.entries())) {
        const [, eventIds] = entry;
        totalIndexes++;
        if (eventIds.size === 0) {
          emptyIndexes++;
        }
      }
    });

    return totalIndexes > 0 ? emptyIndexes / totalIndexes : 0;
  }
}

export default EventIndexingSystem;