import type { IncomingMessage } from "node:http";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const loadKeyFromEnvFile = (targetKey: string, logScope: string) => {
  if (process.env[targetKey]) {
    return;
  }
  const envPath = path.resolve(__dirname, ".env");
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      if (key !== targetKey) continue;
      const value = line.slice(eq + 1).trim();
      if (value.length > 0) {
        process.env[targetKey] = value;
      }
      break;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[${logScope}] Failed to read .env file`, error);
    }
  }
};

loadKeyFromEnvFile("PLANTNET_API_KEY", "plantnet-proxy");
loadKeyFromEnvFile("OPENAI_API_KEY", "openai-proxy");

const PLANTNET_ENDPOINT = "https://my-api.plantnet.org/v2/identify/all";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const collectRequestBody = async (req: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const plantNetProxyPlugin = (): PluginOption => ({
  name: "plantnet-proxy",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/api/plantnet/identify", async (req, res, next) => {
      if (!req.url) {
        next();
        return;
      }

      if (req.method === "OPTIONS") {
        const origin = req.headers.origin ?? "*";
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          req.headers["access-control-request-headers"] ?? "content-type",
        );
        res.end();
        return;
      }

      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Allow", "POST, OPTIONS");
        res.end();
        return;
      }

      const requestId = Math.random().toString(36).slice(2, 8);

      try {
        const origin = req.headers.origin ?? "*";
        const requestUrl = new URL(req.url, "http://localhost");
        const forwardUrl = new URL(PLANTNET_ENDPOINT);

        const queryApiKey = requestUrl.searchParams.get("api-key")?.trim();
        const apiKey = queryApiKey && queryApiKey.length > 0 ? queryApiKey : process.env.PLANTNET_API_KEY ?? "";

        if (!apiKey) {
          console.warn(`[plantnet-proxy] (#${requestId}) PlantNet API key is missing`);
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.end(JSON.stringify({ error: "Missing PlantNet API key" }));
          return;
        }

        forwardUrl.searchParams.set("api-key", apiKey);
        requestUrl.searchParams.forEach((value, key) => {
          if (key !== "api-key") {
            forwardUrl.searchParams.set(key, value);
          }
        });

        const body = await collectRequestBody(req);
        const headers: Record<string, string> = {};

        const contentType = req.headers["content-type"];
        if (contentType) {
          headers["content-type"] = Array.isArray(contentType)
            ? contentType.join("; ")
            : contentType;
        }

        const accept = req.headers.accept;
        headers.accept = accept && !Array.isArray(accept) ? accept : "application/json";

        const acceptLanguage = req.headers["accept-language"];
        if (acceptLanguage) {
          headers["accept-language"] = Array.isArray(acceptLanguage)
            ? acceptLanguage.join(", ")
            : acceptLanguage;
        }

        const userAgent = req.headers["user-agent"];
        if (userAgent && !Array.isArray(userAgent)) {
          headers["user-agent"] = userAgent;
        }

        const payloadSize = typeof body.byteLength === "number" ? body.byteLength : body.length ?? 0;
        const safeUrl = new URL(forwardUrl.toString());
        safeUrl.searchParams.delete("api-key");
        console.info(
          `[plantnet-proxy] (#${requestId}) forwarding -> ${safeUrl.pathname}${safeUrl.search || ""} (${payloadSize} bytes)`,
        );

        const response = await fetch(forwardUrl, {
          method: "POST",
          headers,
          body,
        });

        const statusMessage = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`.trim();
        if (!response.ok) {
          console.warn(`[plantnet-proxy] (#${requestId}) upstream responded ${statusMessage}`);
        } else {
          console.info(`[plantnet-proxy] (#${requestId}) upstream responded ${statusMessage}`);
        }

        res.statusCode = response.status;
        res.setHeader("Access-Control-Allow-Origin", origin);
        response.headers.forEach((value, key) => {
          const normalizedKey = key.toLowerCase();
          if (
            normalizedKey === "access-control-allow-origin" ||
            normalizedKey === "content-length" ||
            normalizedKey === "content-encoding" ||
            normalizedKey === "transfer-encoding"
          ) {
            return;
          }
          res.setHeader(key, value);
        });

        const payload = Buffer.from(await response.arrayBuffer());
        res.end(payload);
      } catch (error) {
        const origin = req.headers.origin ?? "*";
        console.error(`[plantnet-proxy] (#${requestId}) request failed`, error);
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.end(JSON.stringify({ error: "PlantNet proxy failed", message: (error as Error).message }));
      }
    });
  },
});

const openAiProxyPlugin = (): PluginOption => ({
  name: "openai-proxy",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/api/openai/policy", async (req, res, next) => {
      if (!req.url) {
        next();
        return;
      }

      if (req.method === "OPTIONS") {
        const origin = req.headers.origin ?? "*";
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          req.headers["access-control-request-headers"] ?? "content-type",
        );
        res.end();
        return;
      }

      if (req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Allow", "POST, OPTIONS");
        res.end();
        return;
      }

      const requestId = Math.random().toString(36).slice(2, 8);

      try {
        const origin = req.headers.origin ?? "*";
        const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";

        if (!apiKey) {
          console.warn(`[openai-proxy] (#${requestId}) OpenAI API key is missing`);
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.end(JSON.stringify({ error: "Missing OpenAI API key" }));
          return;
        }

        const bodyBuffer = await collectRequestBody(req);
        const bodyText = bodyBuffer.toString("utf8");
        const trimmedBody = bodyText.trim();
        if (!trimmedBody) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.end(JSON.stringify({ error: "Missing request body" }));
          return;
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        };

        const userAgent = req.headers["user-agent"];
        if (userAgent && !Array.isArray(userAgent)) {
          headers["user-agent"] = userAgent;
        }

        const payloadSize = typeof bodyBuffer.byteLength === "number" ? bodyBuffer.byteLength : bodyBuffer.length ?? 0;
        console.info(`[openai-proxy] (#${requestId}) forwarding -> /v1/chat/completions (${payloadSize} bytes)`);

        const response = await fetch(OPENAI_ENDPOINT, {
          method: "POST",
          headers,
          body: trimmedBody,
        });

        const statusMessage = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`.trim();
        if (!response.ok) {
          console.warn(`[openai-proxy] (#${requestId}) upstream responded ${statusMessage}`);
        } else {
          console.info(`[openai-proxy] (#${requestId}) upstream responded ${statusMessage}`);
        }

        res.statusCode = response.status;
        res.setHeader("Access-Control-Allow-Origin", origin);
        response.headers.forEach((value, key) => {
          const normalizedKey = key.toLowerCase();
          if (
            normalizedKey === "access-control-allow-origin" ||
            normalizedKey === "content-length" ||
            normalizedKey === "content-encoding" ||
            normalizedKey === "transfer-encoding"
          ) {
            return;
          }
          res.setHeader(key, value);
        });

        const responseBuffer = Buffer.from(await response.arrayBuffer());
        res.end(responseBuffer);
      } catch (error) {
        const origin = req.headers.origin ?? "*";
        console.error(`[openai-proxy] (#${requestId}) request failed`, error);
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.end(JSON.stringify({ error: "OpenAI proxy failed", message: (error as Error).message }));
      }
    });
  },
});

export default defineConfig({
  root: "app",
  envDir: path.resolve(__dirname),
  plugins: [react(), plantNetProxyPlugin(), openAiProxyPlugin()],
  publicDir: "public",
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "core"),
      "@services": path.resolve(__dirname, "services"),
      "@config": path.resolve(__dirname, "config"),
    },
  },
  server: {
    fs: {
      allow: [
        "..",
        path.resolve(__dirname, "core"),
        path.resolve(__dirname, "services"),
        path.resolve(__dirname, "config"),
      ],
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});

