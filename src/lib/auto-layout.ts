// src/lib/auto-layout.ts
// Uses @dagrejs/dagre to auto-layout flow nodes in a clean top-down tree

import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 300;
const NODE_HEIGHT = 200;

/**
 * Applies Dagre auto-layout to a set of React Flow nodes and edges.
 * Returns a new array of nodes with updated positions.
 * Uses dynamic import to avoid bundle initialization issues with dagre CJS module.
 */
export async function getAutoLayoutNodes(
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
): Promise<Node[]> {
    const dagre = (await import('@dagrejs/dagre')).default;
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: direction,
        nodesep: 60,
        ranksep: 80,
        marginx: 40,
        marginy: 40,
    });

    // Add nodes
    for (const node of nodes) {
        g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // Add edges
    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    // Map positions back
    return nodes.map((node) => {
        const pos = g.node(node.id);
        return {
            ...node,
            position: {
                x: pos.x - NODE_WIDTH / 2,
                y: pos.y - NODE_HEIGHT / 2,
            },
        };
    });
}
