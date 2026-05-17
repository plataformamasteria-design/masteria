const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/automations/editor-v4/simulator/FlowSimulatorUI.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace iPhone borders
content = content.replace(/sm:border-\[10px\]/g, 'sm:border-[4px]');
content = content.replace(/border-\[10px\]/g, 'border-[4px]');

// Replace colors
// primary instead of violet
content = content.replace(/bg-violet-600/g, 'bg-primary');
content = content.replace(/bg-violet-700/g, 'bg-primary/90');
content = content.replace(/text-violet-600/g, 'text-primary');
content = content.replace(/text-violet-700/g, 'text-primary');
content = content.replace(/border-violet-600/g, 'border-primary');
content = content.replace(/bg-violet-100/g, 'bg-primary/10');
content = content.replace(/bg-violet-50/g, 'bg-primary/5');
content = content.replace(/text-violet-100/g, 'text-primary-foreground/70');
content = content.replace(/border-violet-200/g, 'border-primary/20');
content = content.replace(/border-violet-100/g, 'border-primary/10');
content = content.replace(/text-violet-300/g, 'text-primary/50');
content = content.replace(/hover:bg-violet-100/g, 'hover:bg-primary/15');
content = content.replace(/hover:text-violet-600/g, 'hover:text-primary');
content = content.replace(/hover:bg-violet-50/g, 'hover:bg-primary/10');
content = content.replace(/hover:bg-violet-700/g, 'hover:bg-primary/90');
content = content.replace(/hover:border-violet-600/g, 'hover:border-primary');
content = content.replace(/ring-violet-500/g, 'ring-primary');

// Removing colorful icon backgrounds for minimalist look
// For example, in Post-Simulation Actions:
// <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
content = content.replace(/bg-violet-100 flex items-center justify-center shrink-0/g, 'flex items-center justify-center shrink-0 text-primary');
content = content.replace(/bg-amber-100 flex items-center justify-center shrink-0/g, 'flex items-center justify-center shrink-0 text-neutral-500');
content = content.replace(/bg-blue-100 flex items-center justify-center shrink-0/g, 'flex items-center justify-center shrink-0 text-neutral-500');
content = content.replace(/bg-neutral-200 flex items-center justify-center shrink-0/g, 'flex items-center justify-center shrink-0 text-neutral-500');

// Make the buttons themselves cleaner
content = content.replace(/bg-amber-50 text-amber-700/g, 'bg-white border border-neutral-200 text-neutral-700');
content = content.replace(/bg-blue-50 text-blue-700/g, 'bg-white border border-neutral-200 text-neutral-700');
content = content.replace(/bg-primary\/5 text-primary px-3 py-2.5/g, 'bg-white border border-neutral-200 text-neutral-700 px-3 py-2.5'); // Since violet-50 was replaced with primary/5

// Clean up learning memory decision background
content = content.replace(/bg-primary\/10 rounded-full flex items-center justify-center/g, 'rounded-full flex items-center justify-center border border-neutral-200');

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI styles updated successfully!');
