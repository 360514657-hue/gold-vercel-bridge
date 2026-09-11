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
    const pathParts = req.query.path;

    const path = Array.isArray(pathParts)
      ? pathParts.join("/")
      : pathParts || "";

    const target = new URL(
      `${CLOUDFLARE_ORIGIN}/${path}`
    );

    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;

      if (Array.isArray(value)) {
        for (const v of value) {
          target.searchParams.append(key, v);
        }
      } else if (value !== undefined) {
        target.searchParams.set(key, value);
      }
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
