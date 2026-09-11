const CLOUDFLARE_ORIGIN =
  "https://gold.360514657.workers.dev";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed"
    });
  }

  try {
    // 不再依赖 req.query.path
    // 直接从真实请求 URL 取路径
    const requestUrl = new URL(
      req.url,
      `https://${req.headers.host}`
    );

    // /api/quote -> quote
    // /api/kline -> kline
    const upstreamPath =
      requestUrl.pathname.startsWith("/api/")
        ? requestUrl.pathname.slice(5)
        : "";

    if (!upstreamPath) {
      return res.status(400).json({
        ok: false,
        error: "Missing API path"
      });
    }

    const target = new URL(
      `${CLOUDFLARE_ORIGIN}/${upstreamPath}`
    );

    // 原样转发所有 query 参数
    for (const [key, value] of requestUrl.searchParams.entries()) {
      target.searchParams.append(key, value);
    }

    const response = await fetch(target.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const body = await response.text();

    res.status(response.status);

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
        "application/json; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    return res.send(body);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || String(error)
    });
  }
}
