import test from "node:test";
import assert from "node:assert/strict";

// Import with provider credentials deliberately absent. These tests never
// contact Alibaba Cloud and never create, start, stop, or purchase resources.
delete process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
delete process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

const provider = await import("../provider.js");

test("provider reports unconfigured when server credentials are absent", () => {
  assert.equal(provider.providerConfigured(), false);
});

test("inventory lookup fails closed without credentials", async () => {
  await assert.rejects(
    provider.describeCloudPhones(),
    error => error?.code === "PROVIDER_NOT_CONFIGURED"
  );
});

test("connection ticket lookup fails closed without credentials", async () => {
  await assert.rejects(
    provider.getConnectionTicket("acp-test-instance", "test-user"),
    error => error?.code === "PROVIDER_NOT_CONFIGURED"
  );
});
