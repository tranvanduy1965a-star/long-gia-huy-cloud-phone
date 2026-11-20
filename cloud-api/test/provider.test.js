import test from "node:test";
import assert from "node:assert/strict";

// Import with provider credentials deliberately absent. These tests never
// contact Alibaba Cloud and never create, start, stop, or purchase resources.
delete process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
delete process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

const provider = await import("../provider.js");
const { collectInventoryPages } = provider;

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


test("inventory pagination follows next tokens and filters invalid records", async () => {
  const calls = [];
  const result = await collectInventoryPages(async params => {
    calls.push(params);
    if (!params.nextToken) {
      return {
        totalCount: 2,
        nextToken: "page-2",
        instanceModel: [{ androidInstanceId: "acp-one" }, {}]
      };
    }
    return {
      totalCount: 2,
      instanceModel: [{ androidInstanceId: "acp-two" }]
    };
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].maxResults, 100);
  assert.equal(calls[0].saleMode, "Instance");
  assert.equal(calls[1].nextToken, "page-2");
  assert.deepEqual(result.instances.map(instance => instance.id), ["acp-one", "acp-two"]);
  assert.equal(result.totalCount, 2);
});

test("inventory pagination rejects a repeated token", async () => {
  await assert.rejects(
    collectInventoryPages(async () => ({ nextToken: "same-token", instanceModel: [] })),
    error => error?.code === "INVENTORY_TOKEN_REPEATED"
  );
});

test("inventory pagination stops at its safe page limit", async () => {
  let page = 0;
  await assert.rejects(
    collectInventoryPages(async () => ({
      nextToken: `token-${++page}`,
      instanceModel: []
    })),
    error => error?.code === "INVENTORY_PAGE_LIMIT"
  );
  assert.equal(page, 20);
});
