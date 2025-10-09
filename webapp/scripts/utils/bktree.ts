export type DistanceFn = (a: string, b: string) => number;

export interface BKTreeResult {
  value: string;
  distance: number;
}

interface BKNode {
  value: string;
  children: Map<number, BKNode>;
}

const SCALE = 1000;

export class BKTree {
  private root: BKNode | null = null;
  private readonly distance: DistanceFn;

  constructor(distance: DistanceFn) {
    this.distance = distance;
  }

  add(value: string): void {
    if (!value) return;
    const node: BKNode = { value, children: new Map() };
    if (!this.root) {
      this.root = node;
      return;
    }
    let current = this.root;
    while (current) {
      const dist = this.distance(value, current.value);
      const bucket = Math.round(dist * SCALE);
      if (bucket === 0) return;
      const existing = current.children.get(bucket);
      if (!existing) {
        current.children.set(bucket, node);
        return;
      }
      current = existing;
    }
  }

  search(query: string, threshold: number): BKTreeResult[] {
    if (!this.root || !query) return [];
    const results: BKTreeResult[] = [];
    const intThreshold = Math.round(Math.max(threshold, 0) * SCALE);
    const stack: BKNode[] = [this.root];

    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      const dist = this.distance(query, node.value);
      if (dist <= threshold) {
        results.push({ value: node.value, distance: dist });
      }
      const bucket = Math.round(dist * SCALE);
      const min = bucket - intThreshold;
      const max = bucket + intThreshold;
      for (const [childBucket, child] of node.children.entries()) {
        if (childBucket >= min && childBucket <= max) {
          stack.push(child);
        }
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }
}

export default BKTree;

