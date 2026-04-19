import { detectFormat } from "./lib/contentDetect";
import { convertDocxToHtml, convertPdfToHtml, convertRtfToHtml } from "./lib/convert";
import { fetchUrl } from "./lib/fetchUrl";
import { processHtml } from "./pipeline/processHtml";
import type { ProcessResult } from "./pipeline/processHtml";
import type { SourceInfo } from "./pipeline/stats";
import type { StatsMode, TransformOptions } from "./lib/types";

export interface DecantOptions extends Partial<TransformOptions> {
  mode?: StatsMode;
  /** Treat the input string as a URL to fetch */
  url?: boolean;
  fetchTimeoutMs?: number;
}

function resolveTransform(opts: DecantOptions): TransformOptions {
  return {
    keepLinks: opts.keepLinks ?? true,
    keepImages: opts.keepImages ?? false,
    preserveTables: opts.preserveTables ?? true,
    maxHeadingLevel: opts.maxHeadingLevel ?? 6,
    aggressive: opts.aggressive ?? false,
  };
}

async function toHtml(
  input: string | Uint8Array,
  opts: DecantOptions,
): Promise<{ html: string; source: SourceInfo }> {
  if (opts.url) {
    if (typeof input !== "string") {
      throw new Error("url option requires a string URL input");
    }
    const result = await fetchUrl(input, { timeoutMs: opts.fetchTimeoutMs });
    return { html: result.html, source: { sourceFormat: "url", sourceChars: input.length } };
  }

  const format = detectFormat(input);

  if (input instanceof Uint8Array) {
    const sourceChars = input.length;
    if (format === "doc") {
      throw new Error(
        "DOC format requires a file path string, not a Uint8Array. Pass the file path directly or convert to DOCX first.",
      );
    }
    if (format === "docx") {
      const html = await convertDocxToHtml(input);
      return { html, source: { sourceFormat: "docx", sourceChars } };
    }
    if (format === "pdf") {
      const html = await convertPdfToHtml(input);
      return { html, source: { sourceFormat: "pdf", sourceChars } };
    }
    const text = new TextDecoder().decode(input);
    if (format === "rtf") {
      const html = await convertRtfToHtml(text);
      return { html, source: { sourceFormat: "rtf", sourceChars } };
    }
    if (format === "unknown") {
      throw new Error("Could not detect format from binary input.");
    }
    // html bytes
    return { html: text, source: { sourceFormat: "html", sourceChars } };
  }

  // string input
  if (format === "rtf") {
    const html = await convertRtfToHtml(input);
    return { html, source: { sourceFormat: "rtf", sourceChars: input.length } };
  }
  // html or unknown — treat as HTML
  return { html: input, source: { sourceFormat: "html" } };
}

export async function decant(
  input: string | Uint8Array,
  options?: DecantOptions,
): Promise<ProcessResult> {
  const opts = options ?? {};
  const { html, source } = await toHtml(input, opts);
  return processHtml(opts.mode ?? "clean", html, resolveTransform(opts), source);
}

export async function clean(
  input: string | Uint8Array,
  options?: Omit<DecantOptions, "mode">,
): Promise<ProcessResult> {
  return decant(input, { ...options, mode: "clean" });
}

export async function extract(
  input: string | Uint8Array,
  options?: Omit<DecantOptions, "mode">,
): Promise<ProcessResult> {
  return decant(input, { ...options, mode: "extract" });
}

export default decant;

// Re-exports for power users
export type {
  TransformOptions,
  ContentStats,
  StatsMode,
  CleanResult,
  ExtractResult,
} from "./lib/types";
export type { ProcessResult, ProcessHtmlOptions } from "./pipeline/processHtml";
export type { SourceInfo } from "./pipeline/stats";
export type { ContentFormat } from "./lib/contentDetect";
export { processHtml } from "./pipeline/processHtml";
export { cleanHtml } from "./pipeline/cleanHtml";
export { extractContent } from "./pipeline/extractContent";
export { toMarkdown } from "./pipeline/toMarkdown";
export { detectFormat } from "./lib/contentDetect";
export { fetchUrl, isValidUrl } from "./lib/fetchUrl";
export {
  convertDocxToHtml,
  convertPdfToHtml,
  convertRtfToHtml,
  convertDocToHtml,
} from "./lib/convert";
export { buildStats, estimateTokens } from "./pipeline/stats";
export { parseMarkdownSections, truncateToTokenBudget } from "./pipeline/tokenBudget";
