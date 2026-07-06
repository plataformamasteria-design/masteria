import { FlowStep } from '@/services/flow-triggers.service';
import { ExecutionContext, NodeResult, NodeHandler } from './types';
import { interpolateTemplate, incrementNodeResponded } from '@/lib/flow-engine';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { tags, contactsToTags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class ConditionNodeHandler implements NodeHandler {
    async execute(step: FlowStep, ctx: ExecutionContext, allSteps: FlowStep[]): Promise<NodeResult> {
        switch (step.type) {
        case 'condition': {
            const condType = step.data.condition_type;
            const condValue = step.data.condition_value;
            const condValues = step.data.condition_values;
            let condMet = false;

            if (condType === 'has_tag') {
                condMet = ctx.contactTags.includes(condValue);
                if (!condMet && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(condValue)) {
                    const tagObj = await db.query.tags.findFirst({ where: eq(tags.id, condValue) });
                    if (tagObj) condMet = ctx.contactTags.includes(tagObj.name);
                }
            } else if (condType === 'response_equals') {
                condMet = ctx.variables.last_response === condValue;
            } else if (condType === 'response_contains') {
                condMet = (ctx.variables.last_response || '').includes(condValue);
            } else if (condType === 'response_in') {
                let options: string[] = [];
                if (Array.isArray(condValues) && condValues.length > 0) {
                    options = condValues.map(s => String(s).trim().toLowerCase());
                } else {
                    options = (condValue || '').split(',').map((s: string) => s.trim().toLowerCase());
                }
                condMet = options.includes((ctx.variables.last_response || '').toLowerCase());
            } else if (condType === 'is_assigned') {
                condMet = !!ctx.variables.assigned_to;
            } else {
                const reqTag = step.data.conditionValue;
                condMet = reqTag ? ctx.contactTags.includes(reqTag) : true;
            }

            return {
                sourceHandle: condMet ? 'yes' : 'no',
                message: `Condition: ${condMet ? 'YES' : 'NO'} `,
            };
        }

        // Legacy compatibility for logic node
        case 'logic': {
            if (step.data.logicType === 'wait') {
                const seconds = parseInt(step.data.delaySeconds || '60');
                return { action: 'delay', delayMs: seconds * 1000, message: `Delay: ${seconds} s` };
            }
            if (step.data.logicType === 'branch') {
                const reqTag = step.data.conditionValue;
                const condMet = reqTag ? ctx.contactTags.includes(reqTag) : true;
                return { sourceHandle: condMet ? 'true' : 'false', message: `Branch: ${condMet} ` };
            }
            if (step.data.logicType === 'filter') {
                return { sourceHandle: 'pass' };
            }
            return {};
        }

        // ---- Logic: Filter (Pass/Block) ----
        case 'filter': {
            const conditions = step.data.conditions || [];
            const matchMode = step.data.match_mode || 'all';

            if (conditions.length === 0) {
                return { sourceHandle: 'pass', message: 'Filter: no conditions (pass)' };
            }

            const results: boolean[] = [];
            for (const cond of conditions) {
                const rawField = await interpolateTemplate(cond.field || '', ctx);
                const rawValue = await interpolateTemplate(cond.value || '', ctx);
                const fieldValue = ctx.variables[cond.field] || rawField || '';
                const fieldStr = String(fieldValue).toLowerCase();
                const valStr = String(rawValue).toLowerCase();
                
                let passed = false;
                switch (cond.operator) {
                    case 'equals': passed = fieldStr === valStr; break;
                    case 'not_equals': passed = fieldStr !== valStr; break;
                    case 'contains': passed = fieldStr.includes(valStr); break;
                    case 'not_contains': passed = !fieldStr.includes(valStr); break;
                    case 'starts_with': passed = fieldStr.startsWith(valStr); break;
                    case 'ends_with': passed = fieldStr.endsWith(valStr); break;
                    case 'greater_than': passed = parseFloat(String(fieldValue)) > parseFloat(rawValue); break;
                    case 'less_than': passed = parseFloat(String(fieldValue)) < parseFloat(rawValue); break;
                    case 'is_empty': passed = !fieldValue; break;
                    case 'is_not_empty': passed = !!fieldValue; break;
                    default: passed = true; break;
                }
                results.push(passed);
            }

            const passed = matchMode === 'all'
                ? results.every((r: boolean) => r)
                : results.some((r: boolean) => r);

            await incrementNodeResponded(ctx.flowId, ctx.companyId, step.id, passed ? 'pass' : 'block');

            return { sourceHandle: passed ? 'pass' : 'block', message: `Filter: ${passed ? 'PASS' : 'BLOCK'} ` };
        }

        // ---- Logic: Router (N handles) ----
        case 'router': {
            const rules = step.data.rules || [];
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                const rawField = await interpolateTemplate(rule.field || '', ctx);
                const rawValue = await interpolateTemplate(rule.value || '', ctx);
                const fieldValue = ctx.variables[rule.field] || rawField || '';
                const fieldStr = String(fieldValue).toLowerCase();
                const valStr = String(rawValue).toLowerCase();
                
                let matches = false;
                switch (rule.operator) {
                    case 'equals': matches = fieldStr === valStr; break;
                    case 'not_equals': matches = fieldStr !== valStr; break;
                    case 'contains': matches = fieldStr.includes(valStr); break;
                    case 'not_contains': matches = !fieldStr.includes(valStr); break;
                    case 'starts_with': matches = fieldStr.startsWith(valStr); break;
                    case 'ends_with': matches = fieldStr.endsWith(valStr); break;
                    case 'greater_than': matches = parseFloat(String(fieldValue)) > parseFloat(rawValue); break;
                    case 'less_than': matches = parseFloat(String(fieldValue)) < parseFloat(rawValue); break;
                    default: matches = false;
                }
                if (matches) {
                    await incrementNodeResponded(ctx.flowId, ctx.companyId, step.id, `route-${i}`);
                    return { sourceHandle: `route-${i}`, message: `Router: matched route ${i}` };
                }
            }
            await incrementNodeResponded(ctx.flowId, ctx.companyId, step.id, 'fallback');
            return { sourceHandle: 'fallback', message: 'Router: fallback' };
        }

        // ---- Logic: Delay ----
            default:
                return { message: 'Unknown condition node type' };
        }
    }
}
