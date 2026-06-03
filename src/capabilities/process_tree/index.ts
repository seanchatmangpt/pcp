import { ProcessTree, ProcessTreeNode, ProcessTreeOperator, ProcessTreeRefusal, Result } from "./types";

/**
 * Defensive panic boundary for unreachable states.
 */
function panic(message: string): never {
    throw new Error(`PANIC [ProcessTree Capability]: ${message}`);
}

export class ProcessTreeEngine {
    private tree: ProcessTree;

    constructor(tree: ProcessTree) {
        this.tree = tree;
    }

    /**
     * Validates the structural soundness of the process tree.
     */
    public validate(): Result<void, ProcessTreeRefusal> {
        if (!this.tree.root) {
            return { success: false, error: "EmptyTree" };
        }
        return this.validateNode(this.tree.root);
    }

    private validateNode(node: ProcessTreeNode): Result<void, ProcessTreeRefusal> {
        switch (node.type) {
            case "Activity":
                if (!node.activity || node.activity.trim() === "") {
                    if (!node.id) panic("Activity node missing id");
                }
                return { success: true, value: undefined };
            case "Silent":
                if (!node.id) panic("Silent node missing id");
                return { success: true, value: undefined };
            case "Operator":
                if (!node.operator) {
                    return { success: false, error: "InvalidOperator" };
                }
                if (!node.children || node.children.length === 0) {
                    return { success: false, error: "InvalidChildCount" };
                }
                
                // Specific child count validation per operator
                switch (node.operator) {
                    case "Sequence":
                    case "ExclusiveChoice":
                    case "Parallel":
                    case "InclusiveChoice":
                    case "Interleaved":
                        if (node.children.length < 2) {
                            return { success: false, error: "InvalidChildCount" };
                        }
                        break;
                    case "Loop":
                        if (node.children.length < 2) {
                            return { success: false, error: "InvalidChildCount" }; // do and redo required
                        }
                        break;
                    default:
                        const _exhaustiveCheck: never = node.operator;
                        panic(`Unhandled ProcessTreeOperator: ${_exhaustiveCheck}`);
                }

                // Recursively validate children
                for (const child of node.children) {
                    const result = this.validateNode(child);
                    if (!result.success) {
                        return result;
                    }
                }
                return { success: true, value: undefined };
            default:
                const _exhaustiveNodeType: never = node;
                panic(`Unhandled ProcessTreeNode type: ${JSON.stringify(_exhaustiveNodeType)}`);
        }
    }

    /**
     * Extracts all unique activities present in the process tree.
     */
    public extractActivities(): Set<string> {
        const activities = new Set<string>();
        this.traverseForActivities(this.tree.root, activities);
        return activities;
    }

    private traverseForActivities(node: ProcessTreeNode, activities: Set<string>): void {
        switch (node.type) {
            case "Activity":
                activities.add(node.activity);
                break;
            case "Silent":
                break;
            case "Operator":
                for (const child of node.children) {
                    this.traverseForActivities(child, activities);
                }
                break;
            default:
                const _exhaustiveCheck: never = node;
                panic(`Unhandled node type during traversal: ${_exhaustiveCheck}`);
        }
    }

    /**
     * Executes the tree to produce potential execution paths (up to max loop iterations).
     * Caution: Computational complexity scales highly with Parallel nodes.
     * Hard-capped interleave output to prevent out-of-memory errors on massive models.
     */
    public generateTraces(maxLoopDepth: number = 1): string[][] {
        const validation = this.validate();
        if (!validation.success) {
            panic(`Cannot generate traces for invalid process tree: ${validation.error}`);
        }

        const traces = this.evaluateNode(this.tree.root, maxLoopDepth);
        // Filter out silent steps
        return traces.map(trace => trace.filter(step => step !== ""));
    }

    private evaluateNode(node: ProcessTreeNode, maxLoopDepth: number): string[][] {
        switch (node.type) {
            case "Activity":
                return [[node.activity]];
            case "Silent":
                return [[""]]; 
            case "Operator":
                switch (node.operator) {
                    case "Sequence":
                        return node.children.reduce((accTraces, child) => {
                            const childTraces = this.evaluateNode(child, maxLoopDepth);
                            if (accTraces.length === 0) return childTraces;
                            const combined: string[][] = [];
                            for (const t1 of accTraces) {
                                for (const t2 of childTraces) {
                                    combined.push([...t1, ...t2]);
                                }
                            }
                            return combined;
                        }, [] as string[][]);

                    case "ExclusiveChoice":
                        return node.children.flatMap(child => this.evaluateNode(child, maxLoopDepth));

                    case "InclusiveChoice":
                        const subsets = this.getSubsets(node.children);
                        const inclusiveTraces: string[][] = [];
                        for (const subset of subsets) {
                            if (subset.length === 0) continue;
                            const subsetTraces = this.evaluateParallel(subset, maxLoopDepth);
                            inclusiveTraces.push(...subsetTraces);
                        }
                        return inclusiveTraces;

                    case "Parallel":
                    case "Interleaved":
                        return this.evaluateParallel(node.children, maxLoopDepth);

                    case "Loop":
                        const doTraces = this.evaluateNode(node.children[0], maxLoopDepth);
                        const redoTraces = this.evaluateNode(node.children[1], maxLoopDepth);
                        
                        const resultTraces: string[][] = [];
                        
                        for (let depth = 0; depth <= maxLoopDepth; depth++) {
                            if (depth === 0) {
                                resultTraces.push(...doTraces);
                            } else {
                                let currentTraces = [...doTraces];
                                for (let i = 0; i < depth; i++) {
                                    const nextTraces: string[][] = [];
                                    for (const t1 of currentTraces) {
                                        for (const tRedo of redoTraces) {
                                            for (const tDo of doTraces) {
                                                nextTraces.push([...t1, ...tRedo, ...tDo]);
                                            }
                                        }
                                    }
                                    currentTraces = nextTraces;
                                }
                                resultTraces.push(...currentTraces);
                            }
                        }

                        if (node.children.length > 2) {
                            const exitTraces = this.evaluateNode(node.children[2], maxLoopDepth);
                            const finalTraces: string[][] = [];
                            for (const r of resultTraces) {
                                for (const e of exitTraces) {
                                    finalTraces.push([...r, ...e]);
                                }
                            }
                            return finalTraces;
                        }
                        
                        return resultTraces;

                    default:
                        const _exhaustiveOp: never = node.operator;
                        panic(`Unhandled operator during evaluation: ${_exhaustiveOp}`);
                }
            default:
                const _exhaustiveNode: never = node;
                panic(`Unhandled node type during evaluation: ${JSON.stringify(_exhaustiveNode)}`);
        }
    }

    private evaluateParallel(children: ProcessTreeNode[], maxLoopDepth: number): string[][] {
        if (children.length === 0) return [[]];
        const evaluatedChildren = children.map(c => this.evaluateNode(c, maxLoopDepth));
        const combinations = this.cartesianProduct(evaluatedChildren);
        
        const allInterleaved: string[][] = [];
        for (const combo of combinations) {
            allInterleaved.push(...this.interleaveMultiple(combo));
        }
        
        // Return unique arrays to prune state explosion slightly
        const unique = new Map<string, string[]>();
        for (const path of allInterleaved) {
            unique.set(path.join("|"), path);
        }
        return Array.from(unique.values());
    }

    private cartesianProduct<T>(arrays: T[][][]): T[][][] {
        if (arrays.length === 0) return [];
        if (arrays.length === 1) return arrays[0].map(x => [x]);
        
        const first = arrays[0];
        const rest = this.cartesianProduct(arrays.slice(1));
        
        const result: T[][][] = [];
        for (const f of first) {
            for (const r of rest) {
                result.push([f, ...r]);
            }
        }
        return result;
    }

    private interleaveMultiple(arrays: string[][]): string[][] {
        if (arrays.length === 0) return [[]];
        if (arrays.length === 1) return [arrays[0]];
        if (arrays.length === 2) return this.interleave(arrays[0], arrays[1]);
        
        const first = arrays[0];
        const restInterleaved = this.interleaveMultiple(arrays.slice(1));
        
        const result: string[][] = [];
        for (const r of restInterleaved) {
            result.push(...this.interleave(first, r));
        }
        return result;
    }

    private interleave(a: string[], b: string[]): string[][] {
        if (a.length === 0) return [b];
        if (b.length === 0) return [a];

        const res1 = this.interleave(a.slice(1), b).map(t => [a[0], ...t]);
        const res2 = this.interleave(a, b.slice(1)).map(t => [b[0], ...t]);

        return [...res1, ...res2];
    }

    private getSubsets<T>(array: T[]): T[][] {
        return array.reduce(
            (subsets, value) => subsets.concat(subsets.map(set => [value, ...set])),
            [[]] as T[][]
        );
    }
}

export * from "./types";
