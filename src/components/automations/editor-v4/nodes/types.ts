import type { NodeProps } from '@xyflow/react';

export type NodeDataV4<T = Record<string, unknown>> = T & {
    label?: string;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onLabelChange?: (label: string) => void;
};

export type NodePropsV4<T = Record<string, unknown>> = Omit<NodeProps, 'data'> & {
    data: NodeDataV4<T>;
};
