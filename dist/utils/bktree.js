"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BKTree = void 0;
const SCALE = 1000;
class BKTree {
    constructor(distance) {
        this.root = null;
        this.distance = distance;
    }
    add(value) {
        if (!value)
            return;
        const node = { value, children: new Map() };
        if (!this.root) {
            this.root = node;
            return;
        }
        let current = this.root;
        while (current) {
            const dist = this.distance(value, current.value);
            const bucket = Math.round(dist * SCALE);
            if (bucket === 0)
                return;
            const existing = current.children.get(bucket);
            if (!existing) {
                current.children.set(bucket, node);
                return;
            }
            current = existing;
        }
    }
    search(query, threshold) {
        if (!this.root || !query)
            return [];
        const results = [];
        const intThreshold = Math.round(Math.max(threshold, 0) * SCALE);
        const stack = [this.root];
        while (stack.length) {
            const node = stack.pop();
            if (!node)
                continue;
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
exports.BKTree = BKTree;
exports.default = BKTree;
