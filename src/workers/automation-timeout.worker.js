"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAutomationTimeoutWorker = initializeAutomationTimeoutWorker;
exports.shutdownAutomationTimeoutWorker = shutdownAutomationTimeoutWorker;
exports.processTimeouts = processTimeouts;
var db_1 = require("@/lib/db");
var schema_1 = require("@/lib/db/schema");
var drizzle_orm_1 = require("drizzle-orm");
var flow_engine_1 = require("@/lib/flow-engine");
var POLLING_INTERVAL_MS = 60000; // Check every minute
var pollingInterval = null;
var isProcessing = false;
var isInitialized = false;
var shutdownHandlersRegistered = false;
function registerShutdownHandlers() {
    var _this = this;
    if (global.__automationTimeoutShutdownRegistered || shutdownHandlersRegistered) {
        return;
    }
    var gracefulShutdown = function (signal) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("[AutomationTimeoutWorker] \uD83D\uDED1 Recebido ".concat(signal, ", encerrando..."));
                    return [4 /*yield*/, shutdownAutomationTimeoutWorker()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    process.on('SIGINT', function () { return gracefulShutdown('SIGINT'); });
    process.on('SIGTERM', function () { return gracefulShutdown('SIGTERM'); });
    shutdownHandlersRegistered = true;
    global.__automationTimeoutShutdownRegistered = true;
    console.log('[AutomationTimeoutWorker] 🔧 Registered shutdown handlers');
}
function processTimeouts() {
    return __awaiter(this, void 0, void 0, function () {
        var now, pausedExecutions, error_1, isTimeout, processedCount, _loop_1, _i, pausedExecutions_1, exec, error_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (isProcessing)
                        return [2 /*return*/];
                    isProcessing = true;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 10, 11, 12]);
                    now = Date.now();
                    pausedExecutions = [];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, db_1.db.query.automationFlowExecutions.findMany({
                            where: (0, drizzle_orm_1.eq)(schema_1.automationFlowExecutions.status, 'paused'),
                            columns: {
                                id: true,
                                variables: true,
                                currentStepId: true,
                                flowId: true,
                            }
                        })];
                case 3:
                    // Find all paused executions
                    pausedExecutions = _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _c.sent();
                    isTimeout = (error_1 === null || error_1 === void 0 ? void 0 : error_1.code) === 'CONNECT_TIMEOUT' || ((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _a === void 0 ? void 0 : _a.includes('timeout')) || ((_b = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _b === void 0 ? void 0 : _b.includes('fetch'));
                    if (isTimeout) {
                        console.warn("[AutomationTimeoutWorker] \u26A0\uFE0F Conex\u00E3o com DB indispon\u00EDvel no momento (timeout). Tentando novamente no pr\u00F3ximo ciclo.");
                        isProcessing = false;
                        return [2 /*return*/];
                    }
                    throw error_1;
                case 5:
                    processedCount = 0;
                    _loop_1 = function (exec) {
                        var execVarsRoot, vars, aiTimeout, waitTimeout, resumeAt, hasAiTimeout, hasWaitTimeout, hasDelayTimeout, stepId_1, conversationId, conv, flow, logic, steps, stepExists;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    execVarsRoot = exec.variables || {};
                                    vars = execVarsRoot.vars || {};
                                    aiTimeout = vars._ai_timeout_at ? parseInt(vars._ai_timeout_at) : null;
                                    waitTimeout = vars._wait_timeout_at ? parseInt(vars._wait_timeout_at) : null;
                                    resumeAt = execVarsRoot._resumeAt ? parseInt(execVarsRoot._resumeAt) : null;
                                    hasAiTimeout = aiTimeout && aiTimeout < now;
                                    hasWaitTimeout = waitTimeout && waitTimeout < now;
                                    hasDelayTimeout = resumeAt && resumeAt < now;
                                    if (!(hasAiTimeout || hasWaitTimeout || hasDelayTimeout)) return [3 /*break*/, 10];
                                    processedCount++;
                                    stepId_1 = (hasAiTimeout ? vars._ai_step_id : (hasWaitTimeout ? vars._wait_step_id : exec.currentStepId)) || exec.currentStepId;
                                    console.log("[AutomationTimeoutWorker] \u23F0 Timeout reached for execution ".concat(exec.id, " at step ").concat(stepId_1));
                                    conversationId = vars._conversation_id || vars.conversationId || execVarsRoot.conversationId;
                                    if (!conversationId) return [3 /*break*/, 3];
                                    return [4 /*yield*/, db_1.db.query.conversations.findFirst({
                                            where: (0, drizzle_orm_1.eq)(schema_1.conversations.id, conversationId)
                                        })];
                                case 1:
                                    conv = _d.sent();
                                    if (!(conv && conv.aiActive === false)) return [3 /*break*/, 3];
                                    console.log("[AutomationTimeoutWorker] \uD83D\uDED1 Execu\u00E7\u00E3o ".concat(exec.id, " abortada no passo ").concat(stepId_1, ". A chave \"IA Ativa\" foi desligada manualmente pelo operador."));
                                    return [4 /*yield*/, db_1.db.update(schema_1.automationFlowExecutions)
                                            .set({ status: 'failed', error: 'Automação cancelada pois a IA foi desativada pelo operador' })
                                            .where((0, drizzle_orm_1.eq)(schema_1.automationFlowExecutions.id, exec.id))];
                                case 2:
                                    _d.sent();
                                    return [2 /*return*/, "continue"];
                                case 3:
                                    // Update context to trigger timeout bypass and clear timeout flags
                                    vars._timeout_triggered_for_step = stepId_1;
                                    if (hasAiTimeout) {
                                        delete vars._ai_timeout_at;
                                        delete vars._ai_step_id;
                                    }
                                    if (hasWaitTimeout) {
                                        delete vars._wait_timeout_at;
                                        delete vars._wait_step_id;
                                    }
                                    if (hasDelayTimeout) {
                                        delete execVarsRoot._resumeAt;
                                    }
                                    // Set back to running
                                    return [4 /*yield*/, db_1.db.update(schema_1.automationFlowExecutions)
                                            .set({ status: 'running', variables: __assign(__assign({}, execVarsRoot), { vars: vars }) })
                                            .where((0, drizzle_orm_1.eq)(schema_1.automationFlowExecutions.id, exec.id))];
                                case 4:
                                    // Set back to running
                                    _d.sent();
                                    return [4 /*yield*/, db_1.db.query.automationFlows.findFirst({
                                            where: (0, drizzle_orm_1.eq)(schema_1.automationFlows.id, exec.flowId),
                                            columns: { executionLogic: true, isActive: true }
                                        })];
                                case 5:
                                    flow = _d.sent();
                                    if (!(flow && flow.isActive && flow.executionLogic)) return [3 /*break*/, 8];
                                    logic = flow.executionLogic;
                                    steps = Array.isArray(logic) ? logic : logic === null || logic === void 0 ? void 0 : logic.steps;
                                    stepExists = steps === null || steps === void 0 ? void 0 : steps.some(function (s) { return s.id === stepId_1; });
                                    if (!!stepExists) return [3 /*break*/, 7];
                                    console.log("[AutomationTimeoutWorker] \uD83D\uDED1 Execu\u00E7\u00E3o ".concat(exec.id, " falhou. N\u00F3 de origem ").concat(stepId_1, " n\u00E3o existe mais no fluxo."));
                                    return [4 /*yield*/, db_1.db.update(schema_1.automationFlowExecutions)
                                            .set({ status: 'failed', error: "N\u00F3 de origem (".concat(stepId_1, ") deletado ou n\u00E3o encontrado no fluxo.") })
                                            .where((0, drizzle_orm_1.eq)(schema_1.automationFlowExecutions.id, exec.id))];
                                case 6:
                                    _d.sent();
                                    return [2 /*return*/, "continue"];
                                case 7:
                                    // Resume execution
                                    (0, flow_engine_1.processFlowExecution)(exec.id, flow.executionLogic, stepId_1)
                                        .catch(function (err) { return console.error("[AutomationTimeoutWorker] Error resuming flow ".concat(exec.id, ":"), err); });
                                    return [3 /*break*/, 10];
                                case 8: 
                                // Flow inactive or deleted
                                return [4 /*yield*/, db_1.db.update(schema_1.automationFlowExecutions)
                                        .set({ status: 'failed', error: 'Flow inactive or missing logic on timeout' })
                                        .where((0, drizzle_orm_1.eq)(schema_1.automationFlowExecutions.id, exec.id))];
                                case 9:
                                    // Flow inactive or deleted
                                    _d.sent();
                                    _d.label = 10;
                                case 10: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, pausedExecutions_1 = pausedExecutions;
                    _c.label = 6;
                case 6:
                    if (!(_i < pausedExecutions_1.length)) return [3 /*break*/, 9];
                    exec = pausedExecutions_1[_i];
                    return [5 /*yield**/, _loop_1(exec)];
                case 7:
                    _c.sent();
                    _c.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9:
                    if (processedCount > 0) {
                        console.log("[AutomationTimeoutWorker] \u2705 Processed ".concat(processedCount, " timed-out executions."));
                    }
                    return [3 /*break*/, 12];
                case 10:
                    error_2 = _c.sent();
                    console.error('[AutomationTimeoutWorker] ❌ Error checking timeouts:', error_2);
                    return [3 /*break*/, 12];
                case 11:
                    isProcessing = false;
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function initializeAutomationTimeoutWorker() {
    return __awaiter(this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (global.__automationTimeoutWorkerInitialized) {
                        console.log('[AutomationTimeoutWorker] Worker já inicializado (hot-reload detectado).');
                        return [2 /*return*/, true];
                    }
                    if (isInitialized)
                        return [2 /*return*/, true];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    registerShutdownHandlers();
                    if (global.__automationTimeoutPollingInterval) {
                        clearInterval(global.__automationTimeoutPollingInterval);
                    }
                    return [4 /*yield*/, processTimeouts()];
                case 2:
                    _a.sent();
                    pollingInterval = setInterval(processTimeouts, POLLING_INTERVAL_MS);
                    global.__automationTimeoutPollingInterval = pollingInterval;
                    isInitialized = true;
                    global.__automationTimeoutWorkerInitialized = true;
                    console.log("[AutomationTimeoutWorker] \u2705 Worker iniciado com sucesso. Polling a cada ".concat(POLLING_INTERVAL_MS / 1000, "s"));
                    return [2 /*return*/, true];
                case 3:
                    error_3 = _a.sent();
                    console.error('[AutomationTimeoutWorker] ❌ Falha ao inicializar:', error_3);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function shutdownAutomationTimeoutWorker() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log('[AutomationTimeoutWorker] 🛑 Encerrando worker...');
            try {
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
                if (global.__automationTimeoutPollingInterval) {
                    clearInterval(global.__automationTimeoutPollingInterval);
                    global.__automationTimeoutPollingInterval = undefined;
                }
                isInitialized = false;
                global.__automationTimeoutWorkerInitialized = false;
                console.log('[AutomationTimeoutWorker] ✅ Worker encerrado com sucesso.');
            }
            catch (error) {
                console.error('[AutomationTimeoutWorker] ❌ Erro ao encerrar worker:', error);
            }
            return [2 /*return*/];
        });
    });
}
