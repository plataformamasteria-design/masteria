"use strict";
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
exports.initializeCopilotSchedulerWorker = initializeCopilotSchedulerWorker;
exports.shutdownCopilotSchedulerWorker = shutdownCopilotSchedulerWorker;
exports.processScheduledTasks = processScheduledTasks;
var db_1 = require("@/lib/db");
var schema_1 = require("@/lib/db/schema");
var drizzle_orm_1 = require("drizzle-orm");
var copilot_engine_1 = require("@/lib/copilot-engine");
var unified_message_sender_service_1 = require("@/services/unified-message-sender.service");
var socket_1 = require("@/lib/socket");
var POLLING_INTERVAL_MS = 60000; // Check every minute
var pollingInterval = null;
var isProcessing = false;
var isInitialized = false;
function processScheduledTasks() {
    return __awaiter(this, void 0, void 0, function () {
        var now, pendingTasks, processedCount, _i, pendingTasks_1, task, res, activeConv, contact, connection, sendResult, savedMessage, e_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isProcessing)
                        return [2 /*return*/];
                    isProcessing = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 18, 19, 20]);
                    now = new Date();
                    return [4 /*yield*/, db_1.db.query.copilotScheduledTasks.findMany({
                            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.copilotScheduledTasks.status, 'pending'), (0, drizzle_orm_1.lte)(schema_1.copilotScheduledTasks.executeAt, now)),
                            orderBy: [(0, drizzle_orm_1.asc)(schema_1.copilotScheduledTasks.executeAt)],
                            limit: 10 // process in batches
                        })];
                case 2:
                    pendingTasks = _a.sent();
                    processedCount = 0;
                    _i = 0, pendingTasks_1 = pendingTasks;
                    _a.label = 3;
                case 3:
                    if (!(_i < pendingTasks_1.length)) return [3 /*break*/, 17];
                    task = pendingTasks_1[_i];
                    console.log("[CopilotScheduler] \u23F0 Executing scheduled task ".concat(task.id, ": \"").concat(task.prompt.slice(0, 50), "...\""));
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 14, , 16]);
                    return [4 /*yield*/, (0, copilot_engine_1.executeCopilotCommand)(task.prompt, task.companyId, task.conversationId || undefined, 30)];
                case 5:
                    res = _a.sent();
                    if (!(res.reply && task.conversationId && task.contactId)) return [3 /*break*/, 12];
                    return [4 /*yield*/, db_1.db.query.conversations.findFirst({
                            where: (0, drizzle_orm_1.eq)(schema_1.conversations.id, task.conversationId)
                        })];
                case 6:
                    activeConv = _a.sent();
                    return [4 /*yield*/, db_1.db.query.contacts.findFirst({
                            where: (0, drizzle_orm_1.eq)(schema_1.contacts.id, task.contactId)
                        })];
                case 7:
                    contact = _a.sent();
                    if (!(activeConv && contact && activeConv.connectionId)) return [3 /*break*/, 12];
                    return [4 /*yield*/, db_1.db.query.connections.findFirst({
                            where: (0, drizzle_orm_1.eq)(schema_1.connections.id, activeConv.connectionId)
                        })];
                case 8:
                    connection = _a.sent();
                    if (!connection) return [3 /*break*/, 12];
                    return [4 /*yield*/, (0, unified_message_sender_service_1.sendUnifiedMessage)({
                            provider: connection.connectionType || 'evolution',
                            connectionId: connection.id,
                            to: contact.phone,
                            message: res.reply,
                        })];
                case 9:
                    sendResult = _a.sent();
                    if (!sendResult.success) return [3 /*break*/, 11];
                    return [4 /*yield*/, db_1.db.insert(schema_1.messages).values({
                            companyId: task.companyId,
                            conversationId: activeConv.id,
                            connectionId: connection.id,
                            senderType: 'AI',
                            senderId: 'copilot_scheduler',
                            content: res.reply,
                            contentType: 'TEXT',
                            providerMessageId: sendResult.messageId || "auto-".concat(Date.now()),
                            status: 'SENT',
                        }).returning()];
                case 10:
                    savedMessage = (_a.sent())[0];
                    if (savedMessage) {
                        (0, socket_1.emitToCompany)(task.companyId, 'chat:new-message', {
                            conversationId: activeConv.id,
                            messageId: savedMessage.id,
                            connectionId: connection.id,
                            contactPhone: contact.phone,
                            contactName: contact.name,
                            content: savedMessage.content,
                            contentType: savedMessage.contentType,
                            isFromMe: true,
                            senderType: 'AGENT',
                            timestamp: new Date().toISOString(),
                        });
                        (0, socket_1.emitToCompany)(task.companyId, 'inbox:update', { timestamp: Date.now() });
                    }
                    return [3 /*break*/, 12];
                case 11:
                    console.error("[CopilotScheduler] Failed to send message for task ".concat(task.id, ":"), sendResult.error);
                    _a.label = 12;
                case 12: 
                // Mark as completed
                return [4 /*yield*/, db_1.db.update(schema_1.copilotScheduledTasks)
                        .set({ status: 'completed', result: res.reply, updatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(schema_1.copilotScheduledTasks.id, task.id))];
                case 13:
                    // Mark as completed
                    _a.sent();
                    processedCount++;
                    return [3 /*break*/, 16];
                case 14:
                    e_1 = _a.sent();
                    console.error("[CopilotScheduler] \u274C Task ".concat(task.id, " failed:"), e_1);
                    // Mark as failed
                    return [4 /*yield*/, db_1.db.update(schema_1.copilotScheduledTasks)
                            .set({ status: 'failed', result: e_1.message, updatedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(schema_1.copilotScheduledTasks.id, task.id))];
                case 15:
                    // Mark as failed
                    _a.sent();
                    return [3 /*break*/, 16];
                case 16:
                    _i++;
                    return [3 /*break*/, 3];
                case 17:
                    if (processedCount > 0) {
                        console.log("[CopilotScheduler] \u2705 Processed ".concat(processedCount, " scheduled AI tasks."));
                    }
                    return [3 /*break*/, 20];
                case 18:
                    error_1 = _a.sent();
                    console.error('[CopilotScheduler] ❌ Error checking scheduled tasks:', error_1);
                    return [3 /*break*/, 20];
                case 19:
                    isProcessing = false;
                    return [7 /*endfinally*/];
                case 20: return [2 /*return*/];
            }
        });
    });
}
function initializeCopilotSchedulerWorker() {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (global.__copilotSchedulerWorkerInitialized) {
                        return [2 /*return*/, true];
                    }
                    if (isInitialized)
                        return [2 /*return*/, true];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    if (global.__copilotSchedulerPollingInterval) {
                        clearInterval(global.__copilotSchedulerPollingInterval);
                    }
                    // Run once immediately
                    return [4 /*yield*/, processScheduledTasks()];
                case 2:
                    // Run once immediately
                    _a.sent();
                    pollingInterval = setInterval(processScheduledTasks, POLLING_INTERVAL_MS);
                    global.__copilotSchedulerPollingInterval = pollingInterval;
                    isInitialized = true;
                    global.__copilotSchedulerWorkerInitialized = true;
                    console.log("[CopilotScheduler] \u2705 Worker started successfully. Polling every ".concat(POLLING_INTERVAL_MS / 1000, "s"));
                    return [2 /*return*/, true];
                case 3:
                    error_2 = _a.sent();
                    console.error('[CopilotScheduler] ❌ Failed to start worker:', error_2);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function shutdownCopilotSchedulerWorker() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                if (pollingInterval)
                    clearInterval(pollingInterval);
                if (global.__copilotSchedulerPollingInterval)
                    clearInterval(global.__copilotSchedulerPollingInterval);
                isInitialized = false;
                global.__copilotSchedulerWorkerInitialized = false;
            }
            catch (error) { }
            return [2 /*return*/];
        });
    });
}
