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

// Read-only connectivity check. It does not create, start, stop, or purchase resources.
export async function describeCloudPhones() {
  const client = createClient();
  const request = new $EDSAIC.DescribeAndroidInstancesRequest({
    maxResults: 100,
    saleMode: "Instance"
  });
  const runtime = new $Util.RuntimeOptions({});
  const response = await client.describeAndroidInstancesWithOptions(request, runtime);
  const body = response.body || {};
  const instances = (body.instanceModel || []).map(item => ({
    id: item.androidInstanceId,
    name: item.androidInstanceName,
    status: item.androidInstanceStatus,
    region: item.regionId,
    androidVersion: item.systemVersion,
    instanceType: item.instanceType
  }));
  return {
    connected: true,
    region,
    totalCount: body.totalCount ?? instances.length,
    instances
  };
}

export async function getConnectionTicket(instanceId, endUserId) {
  const client = createClient();
  const request = new $EDSAIC.BatchGetAcpConnectionTicketRequest({
    instanceIds: [instanceId],
    endUserId
  });
  const runtime = new $Util.RuntimeOptions({});
  const response = await client.batchGetAcpConnectionTicketWithOptions(request, runtime);
  const model = response.body?.instanceConnectionModels?.[0];
  if (!model?.ticket || !model?.appInstanceId) {
    const error = new Error("Alibaba Cloud did not return a ready connection ticket.");
    error.code = model?.errorCode || model?.taskStatus || "TICKET_NOT_READY";
    throw error;
  }
  return {
    ticket: model.ticket,
    appInstanceId: model.appInstanceId,
    persistentAppInstanceId: model.persistentAppInstanceId,
    appInstanceGroupId: model.appInstanceGroupId
  };
}
