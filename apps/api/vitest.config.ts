import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: "../../.env" });
// swap the trailing db name: .../in_network -> .../in_network_test
const testDbUrl = process.env.DATABASE_URL!.replace(/\/[^/?]+(\?|$)/, "/in_network_test$1");

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    env: { TZ: "UTC", DATABASE_URL: testDbUrl },
    globalSetup: ["./test/global-setup.ts"],
  },
});
