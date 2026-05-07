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
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
function json(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}
function getCurrencyGuess(symbol) {
    var upper = symbol.toUpperCase();
    if (upper.endsWith('.DE') || upper.endsWith('.F') || upper.endsWith('.DU'))
        return 'EUR';
    if (upper.endsWith('.L'))
        return 'GBP';
    if (upper.endsWith('.TO'))
        return 'CAD';
    if (upper.endsWith('.T'))
        return 'JPY';
    return 'USD';
}
function fetchYahooQuote(symbol) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, data, item;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=".concat(encodeURIComponent(symbol));
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                Accept: 'application/json',
                                'User-Agent': 'KairosMarketProxy/1.0',
                            },
                        })];
                case 1:
                    res = _d.sent();
                    if (!res.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = (_d.sent());
                    item = (_b = (_a = data.quoteResponse) === null || _a === void 0 ? void 0 : _a.result) === null || _b === void 0 ? void 0 : _b[0];
                    if (!(item === null || item === void 0 ? void 0 : item.regularMarketPrice) || item.regularMarketPrice <= 0)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            symbol: symbol.toUpperCase(),
                            name: (_c = item.longName) !== null && _c !== void 0 ? _c : item.shortName,
                            currency: item.currency,
                            price: item.regularMarketPrice,
                            change: item.regularMarketChange,
                            changePercent: item.regularMarketChangePercent,
                            provider: 'yahoo',
                        }];
            }
        });
    });
}
function fetchYahooSearch(query, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, data, seen, mapped, _i, _a, item, symbol;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    url = "https://query2.finance.yahoo.com/v1/finance/search?q=".concat(encodeURIComponent(query), "&quotesCount=").concat(Math.max(limit, 10), "&newsCount=0");
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                Accept: 'application/json',
                                'User-Agent': 'KairosMarketProxy/1.0',
                            },
                        })];
                case 1:
                    res = _f.sent();
                    if (!res.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = (_f.sent());
                    seen = new Set();
                    mapped = [];
                    for (_i = 0, _a = (_b = data.quotes) !== null && _b !== void 0 ? _b : []; _i < _a.length; _i++) {
                        item = _a[_i];
                        symbol = (_c = item.symbol) === null || _c === void 0 ? void 0 : _c.toUpperCase();
                        if (!symbol || seen.has(symbol))
                            continue;
                        seen.add(symbol);
                        mapped.push({
                            symbol: symbol,
                            description: (_e = (_d = item.longname) !== null && _d !== void 0 ? _d : item.shortname) !== null && _e !== void 0 ? _e : symbol,
                            type: item.quoteType,
                            provider: 'yahoo',
                        });
                        if (mapped.length >= limit)
                            break;
                    }
                    return [2 /*return*/, mapped];
            }
        });
    });
}
function fetchStooqQuote(symbol) {
    return __awaiter(this, void 0, void 0, function () {
        var stooqSymbol, url, res, csv, firstLine, parts, parsedSymbol, price;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    stooqSymbol = symbol.trim().toLowerCase();
                    url = "https://stooq.com/q/l/?s=".concat(encodeURIComponent(stooqSymbol), "&i=d");
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                'User-Agent': 'KairosMarketProxy/1.0',
                            },
                        })];
                case 1:
                    res = _b.sent();
                    if (!res.ok)
                        return [2 /*return*/, null];
                    return [4 /*yield*/, res.text()];
                case 2:
                    csv = (_b.sent()).trim();
                    firstLine = csv.split('\n').find(function (line) { return line.trim().length > 0; });
                    if (!firstLine)
                        return [2 /*return*/, null];
                    parts = firstLine.split(',');
                    if (parts.length < 7)
                        return [2 /*return*/, null];
                    parsedSymbol = (_a = parts[0]) === null || _a === void 0 ? void 0 : _a.toUpperCase();
                    price = Number(parts[6]);
                    if (!parsedSymbol || !Number.isFinite(price) || price <= 0)
                        return [2 /*return*/, null];
                    return [2 /*return*/, {
                            symbol: parsedSymbol,
                            name: parsedSymbol,
                            currency: getCurrencyGuess(parsedSymbol),
                            price: price,
                            change: 0,
                            changePercent: 0,
                            provider: 'stooq',
                        }];
            }
        });
    });
}
function marketProxyPlugin() {
    var _this = this;
    var handler = function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var url, endpoint, symbol, query, limit, yahoo, stooq, yahoo, stooq, results, _a;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    url = req.url ? new URL(req.url, 'http://localhost') : null;
                    if (!url || !url.pathname.startsWith('/api/market/'))
                        return [2 /*return*/, false];
                    endpoint = url.pathname.replace('/api/market/', '');
                    symbol = (_c = (_b = url.searchParams.get('symbol')) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
                    query = (_e = (_d = url.searchParams.get('q')) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : '';
                    limit = Math.max(1, Math.min(20, Number((_f = url.searchParams.get('limit')) !== null && _f !== void 0 ? _f : '8') || 8));
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 10, , 11]);
                    if (!(endpoint === 'quote')) return [3 /*break*/, 4];
                    if (!symbol) {
                        json(res, 400, { error: 'Missing symbol parameter.' });
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchYahooQuote(symbol)];
                case 2:
                    yahoo = _g.sent();
                    if (yahoo) {
                        json(res, 200, yahoo);
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchStooqQuote(symbol)];
                case 3:
                    stooq = _g.sent();
                    if (stooq) {
                        json(res, 200, stooq);
                        return [2 /*return*/, true];
                    }
                    json(res, 404, { error: 'No quote found.' });
                    return [2 /*return*/, true];
                case 4:
                    if (!(endpoint === 'snapshot')) return [3 /*break*/, 7];
                    if (!symbol) {
                        json(res, 400, { error: 'Missing symbol parameter.' });
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchYahooQuote(symbol)];
                case 5:
                    yahoo = _g.sent();
                    if (yahoo) {
                        json(res, 200, yahoo);
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchStooqQuote(symbol)];
                case 6:
                    stooq = _g.sent();
                    if (stooq) {
                        json(res, 200, stooq);
                        return [2 /*return*/, true];
                    }
                    json(res, 404, { error: 'No snapshot found.' });
                    return [2 /*return*/, true];
                case 7:
                    if (!(endpoint === 'search')) return [3 /*break*/, 9];
                    if (!query) {
                        json(res, 400, { error: 'Missing q parameter.' });
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchYahooSearch(query, limit)];
                case 8:
                    results = _g.sent();
                    json(res, 200, { results: results });
                    return [2 /*return*/, true];
                case 9: return [2 /*return*/, false];
                case 10:
                    _a = _g.sent();
                    json(res, 502, { error: 'Market proxy upstream request failed.' });
                    return [2 /*return*/, true];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    return {
        name: 'kairos-market-proxy',
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var handled;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, handler(req, res)];
                        case 1:
                            handled = _a.sent();
                            if (!handled)
                                next();
                            return [2 /*return*/];
                    }
                });
            }); });
        },
        configurePreviewServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var handled;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, handler(req, res)];
                        case 1:
                            handled = _a.sent();
                            if (!handled)
                                next();
                            return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), marketProxyPlugin()],
    server: {
        port: 3000,
        open: true,
    },
});
