export interface CrawlQueueEntry {
  url: string;
  depth: number;
}

export interface CrawlQueueOptions {
  maxDepth: number;
  maxSize: number;
}

export class CrawlQueue {
  private readonly entries: CrawlQueueEntry[] = [];
  private readonly queued = new Set<string>();
  private readonly seen = new Set<string>();

  constructor(private readonly options: CrawlQueueOptions) {}

  enqueue(url: string, depth: number): boolean {
    if (depth > this.options.maxDepth) return false;
    if (this.seen.has(url) || this.queued.has(url)) return false;
    if (this.entries.length >= this.options.maxSize) return false;

    this.entries.push({ url, depth });
    this.queued.add(url);
    return true;
  }

  dequeue(): CrawlQueueEntry | undefined {
    const entry = this.entries.shift();
    if (!entry) return undefined;

    this.queued.delete(entry.url);
    this.seen.add(entry.url);
    return entry;
  }

  hasSeen(url: string): boolean {
    return this.seen.has(url);
  }

  get size(): number {
    return this.entries.length;
  }

  get seenCount(): number {
    return this.seen.size;
  }
}
