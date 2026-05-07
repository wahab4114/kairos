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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
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
function hashString(value) {
    var hash = 0;
    for (var i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
function stripCData(value) {
    return value
        .replace(/^<!\[CDATA\[/, '')
        .replace(/\]\]>$/, '')
        .trim();
}
function decodeXmlEntities(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}
function fetchYahooNewsViaSearch(symbol, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, data, upper, rows, focused, selected;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    url = "https://query2.finance.yahoo.com/v1/finance/search?q=".concat(encodeURIComponent(symbol), "&quotesCount=1&newsCount=").concat(Math.max(limit * 3, 20));
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                Accept: 'application/json, text/plain, */*',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            },
                        })];
                case 1:
                    res = _b.sent();
                    if (!res.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = (_b.sent());
                    upper = symbol.toUpperCase();
                    rows = ((_a = data.news) !== null && _a !== void 0 ? _a : [])
                        .filter(function (item) { return item.title && item.link; })
                        .sort(function (a, b) { var _a, _b; return ((_a = b.providerPublishTime) !== null && _a !== void 0 ? _a : 0) - ((_b = a.providerPublishTime) !== null && _b !== void 0 ? _b : 0); });
                    focused = rows.filter(function (item) { var _a; return ((_a = item.relatedTickers) !== null && _a !== void 0 ? _a : []).some(function (t) { return t.toUpperCase() === upper; }); });
                    selected = (focused.length >= Math.min(2, limit) ? focused : rows).slice(0, limit);
                    return [2 /*return*/, selected.map(function (item) {
                            var _a, _b, _c;
                            var link = item.link;
                            var publishTime = item.providerPublishTime && item.providerPublishTime > 0
                                ? item.providerPublishTime
                                : Math.floor(Date.now() / 1000);
                            return {
                                id: hashString((_a = item.uuid) !== null && _a !== void 0 ? _a : "".concat(item.title, "-").concat(link)),
                                headline: item.title.trim(),
                                source: ((_b = item.publisher) === null || _b === void 0 ? void 0 : _b.trim()) || 'Yahoo Finance',
                                url: link,
                                summary: ((_c = item.summary) === null || _c === void 0 ? void 0 : _c.trim()) || '',
                                datetime: publishTime,
                            };
                        })];
            }
        });
    });
}
function fetchYahooNewsViaRss(symbol, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, xml, itemRegex, items, match, block, title, link, description, pubDate, cleanTitle, cleanLink, cleanDescription, timestampMs, datetime;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    url = "https://feeds.finance.yahoo.com/rss/2.0/headline?s=".concat(encodeURIComponent(symbol), "&region=US&lang=en-US");
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            },
                        })];
                case 1:
                    res = _e.sent();
                    if (!res.ok)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, res.text()];
                case 2:
                    xml = _e.sent();
                    itemRegex = /<item>([\s\S]*?)<\/item>/g;
                    items = [];
                    match = itemRegex.exec(xml);
                    while (match) {
                        block = match[1];
                        title = (_a = block.match(/<title>([\s\S]*?)<\/title>/)) === null || _a === void 0 ? void 0 : _a[1];
                        link = (_b = block.match(/<link>([\s\S]*?)<\/link>/)) === null || _b === void 0 ? void 0 : _b[1];
                        description = (_c = block.match(/<description>([\s\S]*?)<\/description>/)) === null || _c === void 0 ? void 0 : _c[1];
                        pubDate = (_d = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)) === null || _d === void 0 ? void 0 : _d[1];
                        if (!title || !link)
                            continue;
                        cleanTitle = decodeXmlEntities(stripCData(title));
                        cleanLink = decodeXmlEntities(stripCData(link));
                        cleanDescription = description ? decodeXmlEntities(stripCData(description)) : '';
                        timestampMs = pubDate ? Date.parse(stripCData(pubDate)) : NaN;
                        datetime = Number.isFinite(timestampMs)
                            ? Math.floor(timestampMs / 1000)
                            : Math.floor(Date.now() / 1000);
                        items.push({
                            id: hashString("".concat(cleanTitle, "-").concat(cleanLink)),
                            headline: cleanTitle,
                            source: 'Yahoo Finance',
                            url: cleanLink,
                            summary: cleanDescription,
                            datetime: datetime,
                        });
                        if (items.length >= limit)
                            break;
                        match = itemRegex.exec(xml);
                    }
                    return [2 /*return*/, items];
            }
        });
    });
}
function fetchYahooNews(symbol, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var fromSearch, fromRss;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchYahooNewsViaSearch(symbol, limit)];
                case 1:
                    fromSearch = _a.sent();
                    if (fromSearch.length > 0)
                        return [2 /*return*/, fromSearch];
                    return [4 /*yield*/, fetchYahooNewsViaRss(symbol, limit)];
                case 2:
                    fromRss = _a.sent();
                    if (fromRss.length > 0)
                        return [2 /*return*/, fromRss];
                    return [2 /*return*/, fetchYfinanceNews(symbol, limit)];
            }
        });
    });
}
function fetchYfinanceNews(symbol, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var parsed, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runPythonJsonScript('yfinance_news.py', [symbol, String(limit)])];
                case 1:
                    parsed = _a.sent();
                    items = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.items) ? parsed.items : [];
                    return [2 /*return*/, items.slice(0, limit)];
            }
        });
    });
}
function runPythonJsonScript(scriptName, args) {
    return __awaiter(this, void 0, void 0, function () {
        var scriptPath, candidates, _loop_1, _i, candidates_1, cmd, state_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    scriptPath = resolve(process.cwd(), 'scripts', scriptName);
                    candidates = ['/usr/local/bin/python3.12', 'python3', 'python'];
                    _loop_1 = function (cmd) {
                        var result;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, new Promise(function (resolveResult) {
                                        var child = spawn(cmd, __spreadArray([scriptPath], args, true), {
                                            cwd: process.cwd(),
                                            stdio: ['ignore', 'pipe', 'pipe'],
                                        });
                                        var stdout = '';
                                        var timeout = setTimeout(function () {
                                            child.kill('SIGTERM');
                                        }, 12000);
                                        child.stdout.on('data', function (chunk) {
                                            stdout += String(chunk);
                                        });
                                        child.on('error', function () {
                                            clearTimeout(timeout);
                                            resolveResult(null);
                                        });
                                        child.on('close', function (code) {
                                            clearTimeout(timeout);
                                            if (code !== 0 && !stdout.trim()) {
                                                resolveResult(null);
                                                return;
                                            }
                                            try {
                                                resolveResult(JSON.parse(stdout));
                                            }
                                            catch (_a) {
                                                resolveResult(null);
                                            }
                                        });
                                    })];
                                case 1:
                                    result = _b.sent();
                                    if (result)
                                        return [2 /*return*/, { value: result }];
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, candidates_1 = candidates;
                    _a.label = 1;
                case 1:
                    if (!(_i < candidates_1.length)) return [3 /*break*/, 4];
                    cmd = candidates_1[_i];
                    return [5 /*yield**/, _loop_1(cmd)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, null];
            }
        });
    });
}
function fetchYfinanceHistory(symbol, days) {
    return __awaiter(this, void 0, void 0, function () {
        var parsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, runPythonJsonScript('yfinance_market_data.py', ['history', symbol, String(days)])];
                case 1:
                    parsed = _a.sent();
                    return [2 /*return*/, Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.closes) ? parsed.closes.filter(function (value) { return Number.isFinite(value) && value > 0; }) : []];
            }
        });
    });
}
function fetchYfinanceFundamentals(symbol) {
    return __awaiter(this, void 0, void 0, function () {
        var parsed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, runPythonJsonScript('yfinance_market_data.py', ['fundamentals', symbol])];
                case 1:
                    parsed = _b.sent();
                    return [2 /*return*/, (_a = parsed === null || parsed === void 0 ? void 0 : parsed.metrics) !== null && _a !== void 0 ? _a : null];
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
        var url, endpoint, symbol, query, limit, yahoo, stooq, yahoo, stooq, results, items, days, closes, metrics, _a;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    url = req.url ? new URL(req.url, 'http://localhost') : null;
                    if (!url || !url.pathname.startsWith('/api/market/'))
                        return [2 /*return*/, false];
                    endpoint = url.pathname.replace('/api/market/', '');
                    symbol = (_c = (_b = url.searchParams.get('symbol')) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
                    query = (_e = (_d = url.searchParams.get('q')) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : '';
                    limit = Math.max(1, Math.min(20, Number((_f = url.searchParams.get('limit')) !== null && _f !== void 0 ? _f : '8') || 8));
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 16, , 17]);
                    if (!(endpoint === 'quote')) return [3 /*break*/, 4];
                    if (!symbol) {
                        json(res, 400, { error: 'Missing symbol parameter.' });
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchYahooQuote(symbol)];
                case 2:
                    yahoo = _h.sent();
                    if (yahoo) {
                        json(res, 200, yahoo);
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchStooqQuote(symbol)];
                case 3:
                    stooq = _h.sent();
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
                    yahoo = _h.sent();
                    if (yahoo) {
                        json(res, 200, yahoo);
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchStooqQuote(symbol)];
                case 6:
                    stooq = _h.sent();
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
                    results = _h.sent();
                    json(res, 200, { results: results });
                    return [2 /*return*/, true];
                case 9:
                    if (!(endpoint === 'news')) return [3 /*break*/, 11];
                    if (!symbol) {
                        json(res, 400, { error: 'Missing symbol parameter.' });
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchYahooNews(symbol, limit)];
                case 10:
                    items = _h.sent();
                    json(res, 200, { items: items });
                    return [2 /*return*/, true];
                case 11:
                    if (!(endpoint === 'history')) return [3 /*break*/, 13];
                    if (!symbol) {
                        json(res, 400, { error: 'Missing symbol parameter.' });
                        return [2 /*return*/, true];
                    }
                    days = Math.max(5, Math.min(730, Number((_g = url.searchParams.get('days')) !== null && _g !== void 0 ? _g : '90') || 90));
                    return [4 /*yield*/, fetchYfinanceHistory(symbol, days)];
                case 12:
                    closes = _h.sent();
                    json(res, 200, { closes: closes, provider: closes.length > 0 ? 'yfinance' : 'none' });
                    return [2 /*return*/, true];
                case 13:
                    if (!(endpoint === 'fundamentals')) return [3 /*break*/, 15];
                    if (!symbol) {
                        json(res, 400, { error: 'Missing symbol parameter.' });
                        return [2 /*return*/, true];
                    }
                    return [4 /*yield*/, fetchYfinanceFundamentals(symbol)];
                case 14:
                    metrics = _h.sent();
                    json(res, 200, { metrics: metrics, provider: metrics ? 'yfinance' : 'none' });
                    return [2 /*return*/, true];
                case 15: return [2 /*return*/, false];
                case 16:
                    _a = _h.sent();
                    json(res, 502, { error: 'Market proxy upstream request failed.' });
                    return [2 /*return*/, true];
                case 17: return [2 /*return*/];
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
