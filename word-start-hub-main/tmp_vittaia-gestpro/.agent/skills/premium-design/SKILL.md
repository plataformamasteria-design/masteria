# Premium Web Design Skill (Claude Inspired)

This skill defines the core principles and techniques for creating "Premium" and "Lovable" web experiences.

## Core Principles

### 1. HSL-First Color Systems
- **Dynamic Adaptability**: Always use HSL for colors to allow easy transparency and theme adjustments.
- **Deep Neutrals**: Avoid pure black (`#000`). Use deep blues or grays (e.g., `hsl(222, 47%, 11%)`) for dark backgrounds to create depth.
- **Vibrant Accents**: Use high-saturation accents for primary actions, but balance them with large areas of neutral space.

### 2. Surfaces and Layering
- **Z-Index Hierarchy**: Use consistent layering with `--surface-100`, `--surface-200`, and `--surface-300`.
- **Glassmorphism**: Use `backdrop-filter: blur()` combined with subtle borders and semi-transparent backgrounds to create a sense of physicality.
- **Shadows**: Use multi-layered soft shadows instead of single-step hard shadows.

### 3. Organic Motion
- **Non-Linear Easing**: Use `cubic-bezier(0.4, 0, 0.2, 1)` or `spring` physics for all transitions.
- **Staggered Entry**: Animate elements sequentially rather than all at once to guide the user's eye.
- **Micro-interactions**: Every interactive element should provide subtle visual feedback (scale change, shadow grow, or subtle glow).

### 4. Advanced Typography
- **Contrast**: Maintain a clear hierarchy between bold, tight-tracking headers and relaxed-leading body text.
- **Spacing**: Use generous whitespace (negative space) to allow the design to "breathe".

## Technical Implementation
- **Tokens**: Consolidate all design tokens in `index.css`.
- **Utilities**: Create reusable utility classes for recurring premium patterns (e.g., `.premium-card`, `.glass-surface`).
- **Components**: Ensure components are responsive and handle theme switching gracefully.
