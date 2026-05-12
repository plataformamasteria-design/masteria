import { createContext, useContext, useState, ReactNode } from "react";

type FlowDirection = "TB" | "LR";

interface FlowLayoutContextValue {
    direction: FlowDirection;
    setDirection: (d: FlowDirection) => void;
    toggleDirection: () => void;
}

const FlowLayoutContext = createContext<FlowLayoutContextValue>({
    direction: "TB",
    setDirection: () => { },
    toggleDirection: () => { },
});

export function FlowLayoutProvider({ children }: { children: ReactNode }) {
    const [direction, setDirection] = useState<FlowDirection>(
        () => (localStorage.getItem("flow_layout_direction") as FlowDirection) || "TB"
    );

    const toggleDirection = () => {
        setDirection((prev) => {
            const next = prev === "TB" ? "LR" : "TB";
            localStorage.setItem("flow_layout_direction", next);
            return next;
        });
    };

    return (
        <FlowLayoutContext.Provider value={{ direction, setDirection, toggleDirection }}>
            {children}
        </FlowLayoutContext.Provider>
    );
}

export const useFlowLayout = () => useContext(FlowLayoutContext);
