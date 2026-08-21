import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const PORT = 8907;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

createServer(async (req, res) => {
  try {
    const path = normalize(new URL(req.url, "http://x").pathname).replace(/^([/\\])+/, "");
    const file = join(root, path === "" || path === "." ? "index.html" : path);
    if (!file.startsWith(root)) throw new Error("traversal");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`fixtures: http://127.0.0.1:${PORT}`));
