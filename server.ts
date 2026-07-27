import express from "express";
import http from "http";
import https from "https";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { XMLParser } from "fast-xml-parser";
import { createServer as createViteServer } from "vite";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;
const NASDAQ_RSS_URL = "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts";
const POLL_INTERVAL = 1000; // 1 second ultra-fast updates

// Persistent HTTPS Keep-Alive Agent for zero-latency session pipeline
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 5000,
});

export interface ReasonDetail {
  code: string;
  title: string;
  description: string;
}

export interface HaltItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  status: "halted" | "resumed" | "quote_resumed";
  halted_at: string | null;
  halted_at_epoch_ms: number | null;
  resumed_at: string | null;
  resumed_at_epoch_ms: number | null;
  resumption_quote_at: string | null;
  resumption_quote_at_epoch_ms: number | null;
  reasons: ReasonDetail[];
  pause_threshold_price: string;
}

// Memory store & Conditional GET headers
let cachedData: HaltItem[] = [];
let lastFetchedMs = Date.now();
let lastETag = `W/"halt-${lastFetchedMs}"`;
let nasdaqRemoteETag = "";
let nasdaqRemoteLastModified = "";
let estimatedFullPayloadBytes = 45000; // ~45KB default XML size estimate

// Polling Performance Statistics
let perfStats = {
  totalPolls: 0,
  hit304Count: 0,
  hit200Count: 0,
  lastLatencyMs: 0,
  avgLatencyMs: 0,
  totalBytesDownloaded: 0,
  totalBytesSaved: 0,
  lastStatusCode: 200,
};

// Helper to convert US Eastern Time (America/New_York) string to UTC epoch ms
function parseNYToEpoch(dateStr: string | number | null | undefined, timeStr: string | number | null | undefined): number | null {
  if (!dateStr || !timeStr) return null;
  const dParts = String(dateStr).trim().split("/");
  if (dParts.length < 3) return null;
  const m = parseInt(dParts[0], 10);
  const d = parseInt(dParts[1], 10);
  const y = parseInt(dParts[2], 10);

  const timeParts = String(timeStr).trim().split(":");
  if (timeParts.length < 2) return null;
  const hh = parseInt(timeParts[0], 10);
  const mm = parseInt(timeParts[1], 10);
  const secParts = (timeParts[2] || "0").split(".");
  const ss = parseInt(secParts[0], 10);
  const ms = parseInt((secParts[1] || "0").padEnd(3, "0").slice(0, 3), 10);

  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(hh) || isNaN(mm)) return null;

  const monthStr = String(m).padStart(2, "0");
  const dayStr = String(d).padStart(2, "0");
  const hourStr = String(hh).padStart(2, "0");
  const minStr = String(mm).padStart(2, "0");
  const secStr = String(ss).padStart(2, "0");
  const msStr = String(ms).padStart(3, "0");

  const dummyUTC = new Date(`${y}-${monthStr}-${dayStr}T${hourStr}:${minStr}:${secStr}.${msStr}Z`);
  if (isNaN(dummyUTC.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(formatter.formatToParts(dummyUTC).map((p) => [p.type, p.value]));
    const nyHour = parseInt(parts.hour === "24" ? "0" : parts.hour, 10);
    const nyDay = parseInt(parts.day, 10);

    const diffHours = hh - nyHour + (d !== nyDay ? (d > nyDay ? 24 : -24) : 0);
    return dummyUTC.getTime() + diffHours * 3600000;
  } catch (e) {
    return dummyUTC.getTime();
  }
}

// Reason Code mapping
function getReasonInfo(codeStr: string): ReasonDetail {
  const code = (codeStr || "").trim().toUpperCase();
  switch (code) {
    case "LUDP":
      return {
        code: "LUDP",
        title: "Volatility Trading Pause (LULD)",
        description: "변동성 완화 장치(LULD). 개별 주식 가격이 5분 동안 일정 비율 이상 급등락할 때 발동되는 5분간의 거래 정지입니다. (서킷브레이커)",
      };
    case "M":
      return {
        code: "M",
        title: "Volatility Trading Pause",
        description: "장내 변동성 정지 (Volatility Trading Pause). 주가가 단기간에 10% 이상 급변할 때 발동되며, 주로 5~10분간 정지됩니다.",
      };
    case "LU":
      return {
        code: "LU",
        title: "Limit Up",
        description: "상한가 변동성 정지 (Limit Up). 주가가 상한가 한도에 도달하여 거래가 일시 정지된 상태입니다.",
      };
    case "DP":
      return {
        code: "DP",
        title: "Limit Down",
        description: "하한가 변동성 정지 (Limit Down). 주가가 하한가 한도에 도달하여 거래가 일시 정지된 상태입니다.",
      };
    case "T1":
      return {
        code: "T1",
        title: "News Pending",
        description: "뉴스 대기 (News Pending). 회사에 중대한 영향을 미칠 뉴스가 발표될 예정일 때 사전 거래 정지가 발동된 상태입니다.",
      };
    case "T2":
      return {
        code: "T2",
        title: "News Released",
        description: "뉴스 발표 (News Released). 정지 사유였던 뉴스가 배포되어 거래 재개 절차가 진행 중임을 의미합니다.",
      };
    case "T5":
      return {
        code: "T5",
        title: "Single Stock Trading Pause In Effect",
        description: "급격한 가격 변동성으로 인한 개별 주식 거래 일시 정지 상태입니다.",
      };
    case "T6":
      return {
        code: "T6",
        title: "Extraordinary Market Activity",
        description: "비정상적 시장 활동 또는 과도한 변동으로 인한 거래 정지 조치 상태입니다.",
      };
    case "T12":
      return {
        code: "T12",
        title: "Additional Information Requested",
        description: "추가 정보 요청 (Additional Information Requested). 거래소에서 회사 측에 추가적인 정보를 요구하여 정지된 상태입니다.",
      };
    case "H10":
      return {
        code: "H10",
        title: "SEC Trading Suspension",
        description: "SEC 거래 정지 (SEC Trading Suspension). 미국 증권거래위원회(SEC)가 해당 주식의 거래를 강제로 정지시켰습니다.",
      };
    case "H11":
      return {
        code: "H11",
        title: "Regulatory Halt",
        description: "규정 미준수 또는 법적 이유로 거래소가 정지 조치했습니다.",
      };
    case "MW1":
      return {
        code: "MW1",
        title: "Market-Wide Circuit Breaker Level 1",
        description: "시장 전체 서킷브레이커 1단계 발동 (S&P 500 지수 7% 하락 시 15분간 전종목 거래 정지)",
      };
    case "MW2":
      return {
        code: "MW2",
        title: "Market-Wide Circuit Breaker Level 2",
        description: "시장 전체 서킷브레이커 2단계 발동 (S&P 500 지수 13% 하락 시 15분간 전종목 거래 정지)",
      };
    case "MW3":
      return {
        code: "MW3",
        title: "Market-Wide Circuit Breaker Level 3",
        description: "시장 전체 서킷브레이커 3단계 발동 (S&P 500 지수 20% 하락 시 당일 잔여시간 거래 종결)",
      };
    default:
      return {
        code: code || "UNKNOWN",
        title: code || "기타 사유",
        description: code ? `사유 코드: ${code}` : "상세 사유가 지정되지 않았습니다.",
      };
  }
}

// Fetch RSS via persistent HTTPS Keep-Alive session with Conditional GET
function fetchNasdaqRssStream(targetUrl = NASDAQ_RSS_URL, redirectCount = 0): Promise<{ statusCode: number; xmlText: string; latencyMs: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 3) {
      return reject(new Error("Too many redirects"));
    }

    const startTime = Date.now();
    const reqHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KitFairy/2.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      Connection: "keep-alive",
    };

    // Conditional Request headers
    if (nasdaqRemoteETag) {
      reqHeaders["If-None-Match"] = nasdaqRemoteETag;
    }
    if (nasdaqRemoteLastModified) {
      reqHeaders["If-Modified-Since"] = nasdaqRemoteLastModified;
    }

    const req = https.get(targetUrl, {
      agent: keepAliveAgent,
      headers: reqHeaders,
    }, (res) => {
      const latencyMs = Date.now() - startTime;

      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://www.nasdaqtrader.com${res.headers.location}`;
        return fetchNasdaqRssStream(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
      }

      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 200,
          xmlText: body,
          latencyMs,
          headers: res.headers,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error("Request timeout"));
    });
  });
}

// Fetch & parse Nasdaq RSS Feed with 304 Conditional GET & Keep-Alive Session
async function pollNasdaqRss() {
  try {
    perfStats.totalPolls++;
    const { statusCode, xmlText, latencyMs, headers } = await fetchNasdaqRssStream();

    perfStats.lastLatencyMs = latencyMs;
    perfStats.lastStatusCode = statusCode;
    perfStats.avgLatencyMs = Math.round(
      (perfStats.avgLatencyMs * (perfStats.totalPolls - 1) + latencyMs) / perfStats.totalPolls
    );

    // 1. Conditional GET Check: 304 Not Modified
    if (statusCode === 304) {
      perfStats.hit304Count++;
      perfStats.totalBytesSaved += estimatedFullPayloadBytes;
      lastFetchedMs = Date.now();

      console.log(
        `[NASDAQ RSS] ⚡ 304 Not Modified | Latency: ${latencyMs}ms | Bytes Saved: ~${Math.round(estimatedFullPayloadBytes / 1024)}KB (Session Keep-Alive)`
      );

      // Broadcast heartbeat status to clients
      broadcastHalts(false);
      return;
    }

    // 2. Full Update (HTTP 200)
    if (statusCode === 200) {
      perfStats.hit200Count++;
      const downloadedBytes = Buffer.byteLength(xmlText, "utf8");
      perfStats.totalBytesDownloaded += downloadedBytes;
      if (downloadedBytes > 0) {
        estimatedFullPayloadBytes = downloadedBytes;
      }

      // Save remote validation headers for subsequent conditional GETs
      if (headers["etag"]) {
        nasdaqRemoteETag = headers["etag"] as string;
      }
      if (headers["last-modified"]) {
        nasdaqRemoteLastModified = headers["last-modified"] as string;
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      });

      const parsed = parser.parse(xmlText);
      let rawItems = parsed?.rss?.channel?.item || [];
      if (!Array.isArray(rawItems)) {
        rawItems = rawItems ? [rawItems] : [];
      }

      const now = Date.now();

      const items: HaltItem[] = rawItems.map((item: any) => {
        const symbol = (item.IssueSymbol || item.title || "").toString().trim();
        const name = (item.IssueName || "").toString().trim();
        let rawMarket = (item.Market || "").toString().trim().toUpperCase();
        let market = "NASDAQ";
        if (["Q", "NASDAQ", "G", "S"].includes(rawMarket)) market = "NASDAQ";
        else if (["N", "NYSE"].includes(rawMarket)) market = "NYSE";
        else if (["A", "P", "AMEX", "NYSE AMERICAN"].includes(rawMarket)) market = "AMEX";
        else if (["Z", "BATS"].includes(rawMarket)) market = "BATS";
        else if (rawMarket) market = rawMarket;

        const code = (item.ReasonCode || "").toString().trim();
        const pausePrice = (item.PauseThresholdPrice || "").toString().trim();

        const resTradeStr = (item.ResumptionTradeTime || "").toString().trim();
        const resQuoteStr = (item.ResumptionQuoteTime || "").toString().trim();

        const haltedEpoch = parseNYToEpoch(item.HaltDate, item.HaltTime);
        const quoteEpoch = resQuoteStr ? parseNYToEpoch(item.ResumptionDate || item.HaltDate, resQuoteStr) : null;
        const tradeEpoch = resTradeStr ? parseNYToEpoch(item.ResumptionDate || item.HaltDate, resTradeStr) : null;

        let status: "halted" | "resumed" | "quote_resumed" = "halted";
        const isLULD = ["LUDP", "LUDT", "M", "LU", "DP"].includes((code || "").toUpperCase().trim());
        const graceMs = isLULD ? 20000 : 0; // 20s grace for volatility halts to allow exchange extension

        if (tradeEpoch && now >= tradeEpoch + graceMs) {
          status = "resumed";
        } else if (quoteEpoch && haltedEpoch && quoteEpoch > haltedEpoch + 1000 && now >= quoteEpoch) {
          status = "quote_resumed";
        }

        const reasonDetail = getReasonInfo(code);

        return {
          id: `${symbol}_${haltedEpoch || Date.now()}`,
          symbol,
          name,
          market,
          status,
          halted_at: haltedEpoch ? new Date(haltedEpoch).toISOString() : null,
          halted_at_epoch_ms: haltedEpoch,
          resumed_at: tradeEpoch ? new Date(tradeEpoch).toISOString() : null,
          resumed_at_epoch_ms: tradeEpoch,
          resumption_quote_at: quoteEpoch ? new Date(quoteEpoch).toISOString() : null,
          resumption_quote_at_epoch_ms: quoteEpoch,
          reasons: [reasonDetail],
          pause_threshold_price: pausePrice,
        };
      });

      // Sort by halted time descending
      items.sort((a, b) => (b.halted_at_epoch_ms || 0) - (a.halted_at_epoch_ms || 0));

      cachedData = items;

      lastFetchedMs = Date.now();
      lastETag = `W/"halt-${lastFetchedMs}"`;

      console.log(
        `[NASDAQ RSS] 📥 200 OK (${items.length} live items, cached: ${cachedData.length}, ${(downloadedBytes / 1024).toFixed(1)}KB) | Latency: ${latencyMs}ms`
      );

      // Broadcast new data to WebSocket clients
      broadcastHalts(true);
    }
  } catch (err) {
    console.error("[NASDAQ RSS] Error in async poll loop:", err);
  }
}

function broadcastHalts(isDataChanged = true) {
  const payload = JSON.stringify({
    type: "data",
    data: cachedData,
    timestamp: lastFetchedMs,
    count: cachedData.length,
    isDataChanged,
    source: "NASDAQ_OFFICIAL_RSS",
    perfStats: {
      ...perfStats,
      keepAliveActive: true,
      conditionalGetActive: true,
    },
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// REST Endpoints
const handleHaltsRequest = (req: express.Request, res: express.Response) => {
  res.setHeader("ETag", lastETag);
  res.setHeader("Content-Type", "application/json");

  // Client conditional GET support
  if (req.headers["if-none-match"] === lastETag && lastETag) {
    return res.status(304).end();
  }

  res.json({
    type: "data",
    data: cachedData,
    timestamp: lastFetchedMs,
    serverTime: Date.now(),
    count: cachedData.length,
    source: "NASDAQ_OFFICIAL_RSS",
    perfStats: {
      ...perfStats,
      keepAliveActive: true,
      conditionalGetActive: true,
    },
  });
};

app.get("/halts", handleHaltsRequest);
app.get("/api/halts", handleHaltsRequest);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    haltCount: cachedData.length,
    lastFetched: lastFetchedMs ? new Date(lastFetchedMs).toISOString() : null,
    source: NASDAQ_RSS_URL,
    optimizations: {
      conditionalGet: "If-None-Match / If-Modified-Since (304 Not Modified)",
      sessionKeepAlive: "Node.js http.Agent Persistent Socket Pipeline",
      asyncLoop: "Non-blocking event loop",
    },
    perfStats,
  });
});

// WebSocket Connection Handling
wss.on("connection", (ws) => {
  // Send immediate cached data on connect
  if (cachedData.length > 0) {
    ws.send(
      JSON.stringify({
        type: "data",
        data: cachedData,
        timestamp: lastFetchedMs,
        count: cachedData.length,
        source: "NASDAQ_OFFICIAL_RSS",
        perfStats: {
          ...perfStats,
          keepAliveActive: true,
          conditionalGetActive: true,
        },
      })
    );
  }

  ws.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (e) {}
  });
});

// Non-blocking Async Polling Loop
pollNasdaqRss();
setInterval(pollNasdaqRss, POLL_INTERVAL);

// Start Full-Stack Express Server with Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 킷 요정 (Kit Fairy) Server running on http://0.0.0.0:${PORT}`);
    console.log(`⚡ Optimization Engine Active: Keep-Alive HTTP Pipeline + 304 Conditional GET`);
    console.log(`📡 NASDAQ RSS Feed Polling Active: ${NASDAQ_RSS_URL}`);
  });
}

startServer();

