import EDSAIC, * as $EDSAIC from "@alicloud/eds-aic20230930";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

const region = process.env.ALIBABA_CLOUD_REGION || "ap-southeast-1";
const endpoint = process.env.ALIBABA_CLOUD_ENDPOINT || `eds-aic.${region}.aliyuncs.com`;
const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

export function providerConfigured() {
  return Boolean(accessKeyId && accessKeySecret);
}

function createClient() {
  if (!providerConfigured()) {
    const error = new Error("Alibaba Cloud credentials are not configured.");
    error.code = "PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  const config = new $OpenApi.Config({ accessKeyId, accessKeySecret });
  config.endpoint = endpoint;
  return new EDSAIC.default(config);
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getModels(response) {
  return response.body?.instanceConnectionModels || [];
}

// Read-only inventory check. It does not create, start, stop, or purchase resources.
// Pure pagination helper, exported so pagination edge cases can be tested offline.
export async function collectInventoryPages(fetchPage) {
  const instances = [];
  const seenTokens = new Set();
  let nextToken;
  let totalCount = 0;
  // Bound pagination to avoid an accidental unbounded provider API loop.
  for (let page = 0; page < 20; page += 1) {
    const body = await fetchPage({
      maxResults: 100,
      saleMode: "Instance",
      ...(nextToken ? { nextToken } : {})
    }) || {};
    totalCount = body.totalCount ?? totalCount;
    instances.push(...(body.instanceModel || []).map(item => ({
      id: item.androidInstanceId,
      name: item.androidInstanceName,
      status: item.androidInstanceStatus,
      region: item.regionId,
      androidVersion: item.systemVersion,
      instanceType: item.instanceType
    })).filter(item => item.id));
    nextToken = body.nextToken;
    if (!nextToken) break;
    if (seenTokens.has(nextToken)) {
      const error = new Error("Alibaba Cloud repeated an inventory pagination token.");
      error.code = "INVENTORY_TOKEN_REPEATED";
      throw error;
    }
    seenTokens.add(nextToken);
    if (page === 19) {
      const error = new Error("Alibaba Cloud inventory exceeded the safe pagination limit.");
      error.code = "INVENTORY_PAGE_LIMIT";
      throw error;
    }
  }
  return { instances, totalCount: totalCount || instances.length };
}

export async function describeCloudPhones() {
  const client = createClient();
  const runtime = new $Util.RuntimeOptions({});
  const inventory = await collectInventoryPages(async params => {
    const request = new $EDSAIC.DescribeAndroidInstancesRequest(params);
    const response = await client.describeAndroidInstancesWithOptions(request, runtime);
    return response.body || {};
  });
  return {
    connected: true,
    region,
    ...inventory
  };
}

// Alibaba may return a TaskId instead of a Ticket. Poll the same operation
// using InstanceTasks until the ticket is ready, or fail with a bounded timeout.
export async function getConnectionTicket(instanceId, endUserId) {
  const client = createClient();
  const runtime = new $Util.RuntimeOptions({});
  let response = await client.batchGetAcpConnectionTicketWithOptions(
    new $EDSAIC.BatchGetAcpConnectionTicketRequest({
      instanceIds: [instanceId],
      endUserId
    }),
    runtime
  );

  let model = getModels(response)[0];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (model?.ticket && model?.appInstanceId) {
      return {
        ticket: model.ticket,
        appInstanceId: model.appInstanceId,
        persistentAppInstanceId: model.persistentAppInstanceId,
        appInstanceGroupId: model.appInstanceGroupId,
        port: model.port
      };
    }

    const taskId = model?.taskId;
    const taskStatus = String(model?.taskStatus || "").toUpperCase();
    if (taskStatus === "FAILED" || model?.errorCode) {
      const error = new Error("Alibaba Cloud could not generate a connection ticket.");
      error.code = model.errorCode || taskStatus;
      throw error;
    }
    if (!taskId) {
      const error = new Error("Alibaba Cloud returned neither a ticket nor a task ID.");
      error.code = "TICKET_NOT_READY";
      throw error;
    }

    if (attempt === 11) break;
    await pause(1000);
    response = await client.batchGetAcpConnectionTicketWithOptions(
      new $EDSAIC.BatchGetAcpConnectionTicketRequest({
        instanceTasks: [{ instanceId, taskId }],
        endUserId
      }),
      runtime
    );
    model = getModels(response)[0];
  }

  const error = new Error("Timed out while waiting for Alibaba Cloud connection ticket.");
  error.code = "TICKET_POLL_TIMEOUT";
  throw error;
}
