
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const defaultOptions = {
    filename: "bundle-report.html",
    gzipSize: true,
    brotliSize: true,
};

const { BROTLI_PARAM_QUALITY, BROTLI_DEFAULT_QUALITY } = constants;

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

const formatBytes = (size) => {
    if (size <= 0) {
        return "0 B";
    }

    if (size < KB) {
        return `${size} B`;
    }

    if (size < MB) {
        return `${(size / KB).toFixed(2)} KB`;
    }

    if (size < GB) {
        return `${(size / MB).toFixed(2)} MB`;
    }

    return `${(size / GB).toFixed(2)} GB`;
};

const escapeHtml = (value) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const normalizeFileName = (value) => {
    const normalized = value.replace(/\\/g, "/");
    return normalized.startsWith("/") ? normalized.slice(1) : normalized;
};

export const visualizer = (userOptions = {}) => {
    const options = { ...defaultOptions, ...userOptions };
    const fileName = normalizeFileName(
        options.filename.endsWith(".html") ? options.filename : `${options.filename}.html`,
    );

    return {
        name: "local-rollup-visualizer",
        generateBundle(_outputOptions, bundle) {
            const entries = Object.entries(bundle)
                .filter(([, output]) => output.type === "chunk")
                .map(([chunkName, chunk]) => {
                    const code = typeof chunk.code === "string" ? chunk.code : "";
                    const buffer = Buffer.from(code, "utf8");
                    const size = buffer.length;

                    const gzipSize = options.gzipSize ? gzipSync(buffer).length : undefined;
                    const brotliSize = options.brotliSize
                        ? brotliCompressSync(buffer, {
                              params: {
                                  [BROTLI_PARAM_QUALITY]: BROTLI_DEFAULT_QUALITY,
                              },
                          }).length
                        : undefined;

                    return {
                        chunkName,
                        size,
                        gzipSize,
                        brotliSize,
                    };
                })
                .sort((a, b) => b.size - a.size);

            const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);

            const tableHeaders = ["Chunk", "Size"];
            if (options.gzipSize) {
                tableHeaders.push("Gzip");
            }

            if (options.brotliSize) {
                tableHeaders.push("Brotli");
            }

            const headerRow = tableHeaders.map((heading) => `<th>${heading}</th>`).join("");

            const tableRows = entries
                .map((entry) => {
                    const cells = [`<td>${escapeHtml(entry.chunkName)}</td>`, `<td>${formatBytes(entry.size)}</td>`];

                    if (options.gzipSize) {
                        cells.push(`<td>${entry.gzipSize ? formatBytes(entry.gzipSize) : "-"}</td>`);
                    }

                    if (options.brotliSize) {
                        cells.push(`<td>${entry.brotliSize ? formatBytes(entry.brotliSize) : "-"}</td>`);
                    }

                    return `<tr>${cells.join("")}</tr>`;
                })
                .join("\n");

            const html = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>Bundle Size Report</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
            :root {
                color-scheme: light dark;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            body {
                margin: 0 auto;
                padding: 2rem 1rem;
                max-width: 960px;
                line-height: 1.5;
                background: #0f172a;
                color: #f8fafc;
            }

            h1 {
                margin-bottom: 0.5rem;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1.5rem;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(4px);
            }

            th,
            td {
                padding: 0.75rem 1rem;
                text-align: left;
            }

            th {
                font-weight: 600;
                border-bottom: 2px solid rgba(248, 250, 252, 0.2);
            }

            tr:nth-child(even) td {
                background: rgba(148, 163, 184, 0.08);
            }

            tr:hover td {
                background: rgba(14, 165, 233, 0.2);
            }

            caption {
                caption-side: top;
                text-align: left;
                font-weight: 600;
                margin-bottom: 0.25rem;
            }

            .summary {
                margin-top: 1rem;
                font-size: 0.95rem;
                color: rgba(248, 250, 252, 0.85);
            }
        </style>
    </head>
    <body>
        <h1>Bundle Size Report</h1>
        <p class="summary">Total JavaScript emitted: <strong>${formatBytes(totalBytes)}</strong>.</p>
        <table>
            <caption>Emitted chunks</caption>
            <thead>
                <tr>${headerRow}</tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </body>
</html>`;

            this.emitFile({
                type: "asset",
                fileName,
                source: html,
            });
        },
    };
};

export default visualizer;
