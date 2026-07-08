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
exports.processPendingCampaigns = processPendingCampaigns;
var db_1 = require("@/lib/db");
var schema_1 = require("@/lib/db/schema");
var drizzle_orm_1 = require("drizzle-orm");
var campaign_sender_1 = require("@/lib/campaign-sender");
var ORPHAN_THRESHOLD_MS = 5 * 60 * 1000;
function getActiveCampaigns() {
    if (!global.__activeCampaignsByConnection) {
        global.__activeCampaignsByConnection = new Map();
    }
    return global.__activeCampaignsByConnection;
}
function markCampaignActive(connectionId, campaignId) {
    var active = getActiveCampaigns();
    if (active.has(connectionId)) {
        console.log("[CampaignProcessor] Conex\u00E3o ".concat(connectionId, " j\u00E1 tem campanha ").concat(active.get(connectionId), " ativa. Pulando ").concat(campaignId, "."));
        return false;
    }
    active.set(connectionId, campaignId);
    console.log("[CampaignProcessor] \u2705 Campanha ".concat(campaignId, " marcada como ativa na conex\u00E3o ").concat(connectionId));
    return true;
}
function markCampaignComplete(connectionId, campaignId) {
    var active = getActiveCampaigns();
    if (active.get(connectionId) === campaignId) {
        active.delete(connectionId);
        console.log("[CampaignProcessor] \u2705 Campanha ".concat(campaignId, " removida da conex\u00E3o ").concat(connectionId));
    }
}
function getBrasiliaTime() {
    return new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
function isOrphanedSendingCampaign(campaign) {
    return __awaiter(this, void 0, void 0, function () {
        var now, channel, campaignId, lastReport, startedSendingAt_1, lastSentAt, lastReportTime, startedSendingAt, lastReport, startedSendingAt_2, lastSentAt, lastReportTime, startedSendingAt;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    now = Date.now();
                    channel = campaign.channel || 'WHATSAPP';
                    campaignId = campaign.id;
                    if (!(channel === 'WHATSAPP')) return [3 /*break*/, 2];
                    return [4 /*yield*/, db_1.db
                            .select({ sentAt: schema_1.whatsappDeliveryReports.sentAt })
                            .from(schema_1.whatsappDeliveryReports)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappDeliveryReports.campaignId, campaignId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.whatsappDeliveryReports.sentAt))
                            .limit(1)];
                case 1:
                    lastReport = _g.sent();
                    if (lastReport.length === 0) {
                        startedSendingAt_1 = ((_a = campaign.sentAt) === null || _a === void 0 ? void 0 : _a.getTime()) || campaign.createdAt.getTime();
                        return [2 /*return*/, now - startedSendingAt_1 > ORPHAN_THRESHOLD_MS];
                    }
                    lastSentAt = (_b = lastReport[0]) === null || _b === void 0 ? void 0 : _b.sentAt;
                    lastReportTime = lastSentAt ? new Date(lastSentAt).getTime() : 0;
                    startedSendingAt = ((_c = campaign.sentAt) === null || _c === void 0 ? void 0 : _c.getTime()) || campaign.createdAt.getTime();
                    // Uma campanha SÓ está órfã se a última mensagem tem mais de 5 min AND a retomada tem mais de 5 min
                    return [2 /*return*/, (now - lastReportTime > ORPHAN_THRESHOLD_MS) && (now - startedSendingAt > ORPHAN_THRESHOLD_MS)];
                case 2:
                    if (!(channel === 'SMS')) return [3 /*break*/, 4];
                    return [4 /*yield*/, db_1.db
                            .select({ sentAt: schema_1.smsDeliveryReports.sentAt })
                            .from(schema_1.smsDeliveryReports)
                            .where((0, drizzle_orm_1.eq)(schema_1.smsDeliveryReports.campaignId, campaignId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.smsDeliveryReports.sentAt))
                            .limit(1)];
                case 3:
                    lastReport = _g.sent();
                    if (lastReport.length === 0) {
                        startedSendingAt_2 = ((_d = campaign.sentAt) === null || _d === void 0 ? void 0 : _d.getTime()) || campaign.createdAt.getTime();
                        return [2 /*return*/, now - startedSendingAt_2 > ORPHAN_THRESHOLD_MS];
                    }
                    lastSentAt = (_e = lastReport[0]) === null || _e === void 0 ? void 0 : _e.sentAt;
                    lastReportTime = lastSentAt ? new Date(lastSentAt).getTime() : 0;
                    startedSendingAt = ((_f = campaign.sentAt) === null || _f === void 0 ? void 0 : _f.getTime()) || campaign.createdAt.getTime();
                    return [2 /*return*/, (now - lastReportTime > ORPHAN_THRESHOLD_MS) && (now - startedSendingAt > ORPHAN_THRESHOLD_MS)];
                case 4: return [2 /*return*/, true];
            }
        });
    });
}
// Executa uma campanha de forma assíncrona (fire-and-forget)
// Cada conexão pode ter apenas uma campanha ativa por vez
function executeCampaignAsync(campaign) {
    return __awaiter(this, void 0, void 0, function () {
        var connectionId, channelUpper, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    connectionId = campaign.connectionId || campaign.companyId;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 8, 9, 10]);
                    channelUpper = (_a = campaign.channel) === null || _a === void 0 ? void 0 : _a.toUpperCase();
                    console.log("[CampaignProcessor] \uD83D\uDE80 Iniciando campanha ".concat(campaign.id, " (").concat(campaign.name, ") na conex\u00E3o ").concat(connectionId));
                    if (!(channelUpper === 'WHATSAPP')) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, campaign_sender_1.sendWhatsappCampaign)(campaign)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 7];
                case 3:
                    if (!(channelUpper === 'SMS')) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, campaign_sender_1.sendSmsCampaign)(campaign)];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 7];
                case 5:
                    if (!(channelUpper === 'VOICE')) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, campaign_sender_1.sendVoiceCampaign)(campaign)];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7:
                    console.log("[CampaignProcessor] \u2705 Campanha ".concat(campaign.id, " (").concat(campaign.name, ") conclu\u00EDda com sucesso"));
                    return [3 /*break*/, 10];
                case 8:
                    error_1 = _b.sent();
                    console.error("[CampaignProcessor] \u274C Erro na campanha ".concat(campaign.id, ":"), error_1);
                    return [3 /*break*/, 10];
                case 9:
                    // Sempre liberar a conexão ao final
                    markCampaignComplete(connectionId, campaign.id);
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
function processPendingCampaigns() {
    return __awaiter(this, void 0, void 0, function () {
        var now, dispatched, skipped, pendingCampaigns, error_2, isTimeout, activeCampaigns, _loop_1, _i, pendingCampaigns_1, campaign;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    now = new Date();
                    dispatched = 0;
                    skipped = 0;
                    pendingCampaigns = [];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.campaigns)
                            .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.inArray)(schema_1.campaigns.status, ['QUEUED', 'PENDING', 'SENDING']), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.campaigns.status, 'SCHEDULED'), (0, drizzle_orm_1.lte)(schema_1.campaigns.scheduledAt, now)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.campaigns.status, 'SCHEDULED'), (0, drizzle_orm_1.isNull)(schema_1.campaigns.scheduledAt))))];
                case 2:
                    pendingCampaigns = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _c.sent();
                    isTimeout = (error_2 === null || error_2 === void 0 ? void 0 : error_2.code) === 'CONNECT_TIMEOUT' || ((_a = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _a === void 0 ? void 0 : _a.includes('timeout')) || ((_b = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _b === void 0 ? void 0 : _b.includes('fetch'));
                    if (isTimeout) {
                        console.warn("[CampaignProcessor] \u26A0\uFE0F Conex\u00E3o com DB indispon\u00EDvel no momento (timeout). Tentando novamente no pr\u00F3ximo ciclo.");
                    }
                    else {
                        console.error("[CampaignProcessor] \u274C Erro ao buscar campanhas pendentes:", error_2.message || error_2);
                    }
                    return [2 /*return*/, {
                            processed: 0,
                            successful: 0,
                            failed: 0,
                            skipped: 0,
                            timestamp: getBrasiliaTime(),
                        }];
                case 4:
                    if (pendingCampaigns.length === 0) {
                        return [2 /*return*/, {
                                processed: 0,
                                successful: 0,
                                failed: 0,
                                skipped: 0,
                                timestamp: getBrasiliaTime(),
                            }];
                    }
                    activeCampaigns = getActiveCampaigns();
                    console.log("[CampaignProcessor] Encontradas ".concat(pendingCampaigns.length, " campanhas pendentes. Conex\u00F5es ativas: ").concat(activeCampaigns.size));
                    _loop_1 = function (campaign) {
                        var connectionId, isOrphaned, updateResult, updateResult;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    connectionId = campaign.connectionId || campaign.companyId;
                                    // Verificar se já existe campanha ativa para esta conexão
                                    if (activeCampaigns.has(connectionId)) {
                                        console.log("[CampaignProcessor] Conex\u00E3o ".concat(connectionId, " ocupada com campanha ").concat(activeCampaigns.get(connectionId), ". Campanha ").concat(campaign.id, " (").concat(campaign.name, ") aguardando."));
                                        skipped++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    if (!(campaign.status === 'SENDING')) return [3 /*break*/, 3];
                                    return [4 /*yield*/, isOrphanedSendingCampaign(campaign)];
                                case 1:
                                    isOrphaned = _d.sent();
                                    if (!isOrphaned) {
                                        console.log("[CampaignProcessor] Campanha ".concat(campaign.id, " processando ativamente. Pulando."));
                                        skipped++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [4 /*yield*/, db_1.db
                                            .update(schema_1.campaigns)
                                            .set({ sentAt: now }) // Atualiza o sentAt para "agora" para resetar a trava
                                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.campaigns.id, campaign.id), (0, drizzle_orm_1.eq)(schema_1.campaigns.status, 'SENDING'), campaign.sentAt ? (0, drizzle_orm_1.eq)(schema_1.campaigns.sentAt, campaign.sentAt) : (0, drizzle_orm_1.isNull)(schema_1.campaigns.sentAt)))
                                            .returning({ id: schema_1.campaigns.id })];
                                case 2:
                                    updateResult = _d.sent();
                                    if (!updateResult || updateResult.length === 0) {
                                        console.log("[CampaignProcessor] Campanha \u00F3rf\u00E3 ".concat(campaign.id, " j\u00E1 foi assumida por outro processo (CAS falhou). Pulando."));
                                        skipped++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    console.log("[CampaignProcessor] \uD83D\uDD04 Lock CAS adquirido para retomar campanha \u00F3rf\u00E3 ".concat(campaign.id, " (").concat(campaign.name, ")."));
                                    return [3 /*break*/, 5];
                                case 3: return [4 /*yield*/, db_1.db
                                        .update(schema_1.campaigns)
                                        .set({ status: 'SENDING', sentAt: now })
                                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.campaigns.id, campaign.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.inArray)(schema_1.campaigns.status, ['QUEUED', 'PENDING']), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.campaigns.status, 'SCHEDULED'), (0, drizzle_orm_1.lte)(schema_1.campaigns.scheduledAt, now)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.campaigns.status, 'SCHEDULED'), (0, drizzle_orm_1.isNull)(schema_1.campaigns.scheduledAt)))))
                                        .returning({ id: schema_1.campaigns.id })];
                                case 4:
                                    updateResult = _d.sent();
                                    if (!updateResult || updateResult.length === 0) {
                                        console.log("[CampaignProcessor] Campanha ".concat(campaign.id, " j\u00E1 sendo processada (CAS falhou). Pulando."));
                                        skipped++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    console.log("[CampaignProcessor] \uD83D\uDD12 Lock adquirido para campanha ".concat(campaign.id, " (").concat(campaign.name, ")."));
                                    _d.label = 5;
                                case 5:
                                    // Marcar conexão como ocupada
                                    if (!markCampaignActive(connectionId, campaign.id)) {
                                        skipped++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    // DISPARA CAMPANHA DE FORMA ASSÍNCRONA (fire-and-forget)
                                    // Cada campanha roda em seu próprio "thread" sem bloquear as outras
                                    executeCampaignAsync(campaign).catch(function (err) {
                                        console.error("[CampaignProcessor] Erro n\u00E3o capturado na campanha ".concat(campaign.id, ":"), err);
                                        markCampaignComplete(connectionId, campaign.id);
                                    });
                                    dispatched++;
                                    console.log("[CampaignProcessor] \uD83D\uDE80 Campanha ".concat(campaign.id, " (").concat(campaign.name, ") disparada em paralelo. Empresa: ").concat(campaign.companyId));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, pendingCampaigns_1 = pendingCampaigns;
                    _c.label = 5;
                case 5:
                    if (!(_i < pendingCampaigns_1.length)) return [3 /*break*/, 8];
                    campaign = pendingCampaigns_1[_i];
                    return [5 /*yield**/, _loop_1(campaign)];
                case 6:
                    _c.sent();
                    _c.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8:
                    console.log("[CampaignProcessor] Ciclo conclu\u00EDdo: ".concat(dispatched, " disparadas, ").concat(skipped, " aguardando"));
                    return [2 /*return*/, {
                            processed: pendingCampaigns.length,
                            successful: dispatched,
                            failed: 0,
                            skipped: skipped,
                            timestamp: getBrasiliaTime(),
                        }];
            }
        });
    });
}
