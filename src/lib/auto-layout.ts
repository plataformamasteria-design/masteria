// src/lib/auto-layout.ts
// Uses @dagrejs/dagre to auto-layout flow nodes in a clean top-down tree

import type { Node, Edge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 320;
const DEFAULT_NODE_HEIGHT = 150;

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
        nodesep: 40,
        ranksep: 70,
        marginx: 40,
        marginy: 40,
    });

    // Add nodes
    for (const node of nodes) {
        const width = node.measured?.width || node.width || DEFAULT_NODE_WIDTH;
        const height = node.measured?.height || node.height || DEFAULT_NODE_HEIGHT;
        g.setNode(node.id, { width, height });
    }

    // Add edges
    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    // Map positions back
    return nodes.map((node) => {
        const pos = g.node(node.id);
        const width = node.measured?.width || node.width || DEFAULT_NODE_WIDTH;
        const height = node.measured?.height || node.height || DEFAULT_NODE_HEIGHT;
        return {
            ...node,
            position: {
                x: pos.x - width / 2,
                y: pos.y - height / 2,
            },
        };
    });
}
