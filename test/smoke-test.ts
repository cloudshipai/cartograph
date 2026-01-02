const OPENCODE_URL = process.env.OPENCODE_URL || "http://localhost:4098";
const CARTOGRAPH_URL = process.env.CARTOGRAPH_URL || "http://localhost:3334";

interface HealthCheck {
  name: string;
  url: string;
  validate: (response: Response, body: string) => boolean;
}

const healthChecks: HealthCheck[] = [
  {
    name: "Cartograph Web UI",
    url: CARTOGRAPH_URL,
    validate: (res, body) => res.ok && body.includes("Cartograph"),
  },
  {
    name: "Cartograph Graph API",
    url: `${CARTOGRAPH_URL}/api/graph`,
    validate: (res, body) => {
      if (!res.ok) return false;
      try {
        const data = JSON.parse(body);
        return Array.isArray(data.nodes) && Array.isArray(data.edges);
      } catch {
        return false;
      }
    },
  },
];

async function runCheck(check: HealthCheck): Promise<boolean> {
  try {
    const response = await fetch(check.url);
    const body = await response.text();
    return check.validate(response, body);
  } catch (error) {
    console.error(`  [${check.name}] Error: ${error}`);
    return false;
  }
}

async function waitForService(check: HealthCheck, maxAttempts = 30): Promise<boolean> {
  console.log(`[Waiting] ${check.name} at ${check.url}...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const success = await runCheck(check);
    if (success) {
      console.log(`  [${check.name}] Ready (attempt ${attempt}/${maxAttempts})`);
      return true;
    }
    await Bun.sleep(1000);
  }
  
  console.log(`  [${check.name}] Failed after ${maxAttempts} attempts`);
  return false;
}

async function testWebSocket(): Promise<boolean> {
  console.log("[Test] WebSocket connection...");
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${CARTOGRAPH_URL.replace("http", "ws")}/ws`);
    const timeout = setTimeout(() => {
      ws.close();
      console.log("  [WebSocket] Timeout");
      resolve(false);
    }, 5000);
    
    ws.onopen = () => {
      clearTimeout(timeout);
      console.log("  [WebSocket] Connected successfully");
      ws.close();
      resolve(true);
    };
    
    ws.onerror = () => {
      clearTimeout(timeout);
      console.log("  [WebSocket] Connection failed");
      resolve(false);
    };
  });
}

async function smokeTest() {
  console.log("=== Cartograph Smoke Test ===");
  console.log(`OpenCode URL: ${OPENCODE_URL}`);
  console.log(`Cartograph URL: ${CARTOGRAPH_URL}`);
  console.log("");

  let allPassed = true;

  for (const check of healthChecks) {
    const passed = await waitForService(check);
    if (!passed) {
      allPassed = false;
      console.log(`FAIL: ${check.name}`);
    } else {
      console.log(`PASS: ${check.name}`);
    }
  }

  const wsPass = await testWebSocket();
  if (!wsPass) {
    allPassed = false;
    console.log("FAIL: WebSocket");
  } else {
    console.log("PASS: WebSocket");
  }

  console.log("");
  if (allPassed) {
    console.log("=== ALL SMOKE TESTS PASSED ===");
    process.exit(0);
  } else {
    console.log("=== SMOKE TESTS FAILED ===");
    process.exit(1);
  }
}

smokeTest().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
