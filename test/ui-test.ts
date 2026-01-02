const CARTOGRAPH_URL = process.env.CARTOGRAPH_URL || "http://localhost:3334";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`PASS: ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error });
    console.log(`FAIL: ${name} - ${error}`);
  }
}

async function testGraphAPIStructure(): Promise<void> {
  await runTest("Graph API returns valid structure", async () => {
    const response = await fetch(`${CARTOGRAPH_URL}/api/graph`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!Array.isArray(data.nodes)) throw new Error("Missing nodes array");
    if (!Array.isArray(data.edges)) throw new Error("Missing edges array");
  });
}

async function testManifestAPI(): Promise<void> {
  await runTest("Manifest API accessible", async () => {
    const response = await fetch(`${CARTOGRAPH_URL}/api/manifest`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });
}

async function testWebUILoads(): Promise<void> {
  await runTest("Web UI HTML loads", async () => {
    const response = await fetch(CARTOGRAPH_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    if (!html.includes("<!DOCTYPE html>") && !html.includes("<!doctype html>")) {
      throw new Error("Response is not HTML");
    }
  });
}

async function testStaticAssets(): Promise<void> {
  await runTest("Static assets served with correct headers", async () => {
    const response = await fetch(`${CARTOGRAPH_URL}/`);
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) {
      throw new Error(`Expected text/html, got ${contentType}`);
    }
  });
}

async function main() {
  console.log("=== Cartograph UI Tests ===");
  console.log(`Testing: ${CARTOGRAPH_URL}`);
  console.log("");

  await testWebUILoads();
  await testGraphAPIStructure();
  await testManifestAPI();
  await testStaticAssets();

  console.log("");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
