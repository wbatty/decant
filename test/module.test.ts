import { afterAll, describe, expect, test } from "bun:test";
import { clean, decant, detectFormat, estimateTokens, extract } from "../src/index";

const SIMPLE_HTML = `<html><body>
  <nav>Navigation noise</nav>
  <article>
    <h1>Hello World</h1>
    <p>This is a <a href="https://example.com">paragraph</a> with content.</p>
  </article>
  <footer>Footer noise</footer>
</body></html>`;

const ARTICLE_HTML = `<html><body>
  <div id="global-nav"><a href="/">Home</a></div>
  <article>
    <h1>The Main Article</h1>
    <p>This is the main article body with sufficient content to pass extraction thresholds.</p>
    <p>It has multiple paragraphs to ensure Readability picks it up as the primary article.</p>
    <p>A third paragraph for good measure and length requirements.</p>
  </article>
  <div class="comments">Comments are closed</div>
</body></html>`;

describe("decant() default export", () => {
  test("accepts HTML string and returns markdown with stats", async () => {
    const result = await decant(SIMPLE_HTML);
    expect(result.markdown).toBeTruthy();
    expect(result.markdown).toContain("Hello World");
    expect(result.stats).toBeTruthy();
    expect(result.stats.mode).toBe("clean");
  });

  test("default mode is clean", async () => {
    const result = await decant(SIMPLE_HTML);
    expect(result.stats.mode).toBe("clean");
  });

  test("mode: extract uses readability", async () => {
    const result = await decant(ARTICLE_HTML, { mode: "extract" });
    expect(result.stats.mode).toBe("extract");
    expect(result.markdown).toContain("The Main Article");
  });

  test("stats show reduction from noisy HTML", async () => {
    const result = await decant(SIMPLE_HTML);
    expect(result.stats.outputChars).toBeLessThan(result.stats.inputChars);
  });
});

describe("clean() named export", () => {
  test("returns mode: clean", async () => {
    const result = await clean(SIMPLE_HTML);
    expect(result.stats.mode).toBe("clean");
  });

  test("keepLinks: false strips markdown link syntax", async () => {
    const result = await clean(SIMPLE_HTML, { keepLinks: false });
    expect(result.markdown).not.toContain("](");
    expect(result.markdown).toContain("paragraph");
  });

  test("keepLinks: true preserves links by default", async () => {
    const result = await clean(SIMPLE_HTML);
    expect(result.markdown).toContain("](https://example.com)");
  });
});

describe("extract() named export", () => {
  test("returns mode: extract", async () => {
    const result = await extract(ARTICLE_HTML);
    expect(result.stats.mode).toBe("extract");
  });

  test("removes known noise elements", async () => {
    const result = await extract(ARTICLE_HTML);
    expect(result.markdown).not.toContain("Comments are closed");
    expect(result.markdown).not.toContain("global-nav");
  });

  test("preserves article content", async () => {
    const result = await extract(ARTICLE_HTML);
    expect(result.markdown).toContain("The Main Article");
  });
});

describe("decant() with binary input", () => {
  test("processes DOCX Uint8Array", async () => {
    const buffer = await Bun.file("test/fixtures/sample.docx").bytes();
    const result = await decant(buffer);
    expect(result.markdown).toContain("Sample Document");
    expect(result.stats.sourceFormat).toBe("docx");
  });

  test("throws on unknown binary input", async () => {
    const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    await expect(decant(unknownBytes)).rejects.toThrow("Could not detect format");
  });
});

describe("decant() with URL input", () => {
  let server: ReturnType<typeof Bun.serve> | null = null;

  const serverHtml = `<html><body>
    <nav>Navigation</nav>
    <article><h1>Test Page</h1><p>Content from the server.</p></article>
  </body></html>`;

  test("fetches and converts URL with { url: true }", async () => {
    server = Bun.serve({
      port: 0,
      fetch() {
        return new Response(serverHtml, {
          headers: { "Content-Type": "text/html" },
        });
      },
    });

    const url = `http://localhost:${server.port}/`;
    const result = await decant(url, { url: true });
    expect(result.markdown).toContain("Test Page");
    expect(result.markdown).toContain("Content from the server");
    expect(result.stats.sourceFormat).toBe("url");
  });

  test("throws on invalid URL", async () => {
    await expect(decant("not-a-url", { url: true })).rejects.toThrow("Invalid URL");
  });

  test("throws when url: true but input is Uint8Array", async () => {
    await expect(decant(new Uint8Array([0x01]), { url: true })).rejects.toThrow(
      "url option requires a string URL input",
    );
  });

  afterAll(() => {
    server?.stop();
  });
});

describe("re-exports for power users", () => {
  test("detectFormat is re-exported and works", () => {
    expect(detectFormat("<p>hello</p>")).toBe("html");
    expect(detectFormat("{\\rtf1 hello}")).toBe("rtf");
  });

  test("estimateTokens is re-exported and works", () => {
    const tokens = estimateTokens("hello world this is a test");
    expect(tokens).toBeGreaterThan(0);
  });
});
