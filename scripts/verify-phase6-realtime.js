require("dotenv").config();

const { createServer } = require("http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { io: createClient } = require("socket.io-client");
const app = require("../src/app");
const eventBus = require("../src/events/event-bus");
const EVENTS = require("../src/events/events");
const Inquiry = require("../src/models/inquiry.model");
const Notification = require("../src/models/notification.model");
const Property = require("../src/models/property.model");
const Agent = require("../src/models/agent.model");
const Agency = require("../src/models/agency.model");
const {
  initializeSocketServer,
} = require("../src/realtime/socket.service");

const waitFor = (socket, eventName, timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);
    const onEvent = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };
    socket.once(eventName, onEvent);
  });

const connectClient = (baseUrl, token, extraAuth = {}) =>
  new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      auth: { token, ...extraAuth },
      transports: ["websocket"],
      forceNew: true,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });

const expectRejectedConnection = (baseUrl, auth) =>
  new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      auth,
      transports: ["websocket"],
      forceNew: true,
    });
    socket.once("connect", () => {
      socket.close();
      reject(new Error("Socket unexpectedly connected"));
    });
    socket.once("connect_error", (error) => {
      socket.close();
      resolve(error.message);
    });
  });

const createInquiry = async (baseUrl, propertyId, suffix) => {
  const response = await fetch(`${baseUrl}/api/v1/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId,
      fullName: "Phase Six Realtime Verification",
      email: `phase6-${suffix}@luxora.com`,
      phone: "+2348000000006",
      message: "Phase 6 realtime notification verification inquiry.",
      source: "Website",
    }),
  });
  const body = await response.json();
  if (response.status !== 201) {
    throw new Error(`Inquiry creation failed: ${JSON.stringify(body)}`);
  }
  return body.inquiry;
};

const authenticatedRequest = async (baseUrl, userId, path, method = "GET") => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: await response.json() };
};

const main = async () => {
  await mongoose.connect(process.env.DBSTRING);

  const properties = await Property.find({ status: "Published" })
    .select("_id agent agency")
    .lean();
  let context;
  for (const property of properties) {
    if (!property.agent || !property.agency) continue;
    const [agent, agency] = await Promise.all([
      Agent.findById(property.agent).select("user status").lean(),
      Agency.findById(property.agency).select("user status").lean(),
    ]);
    if (agent?.user && agency?.user && String(agent.user) !== String(agency.user)) {
      context = { property, agentUserId: String(agent.user), agencyUserId: String(agency.user) };
      break;
    }
  }
  if (!context) throw new Error("No eligible published property with Agent and Agency users");

  const httpServer = createServer(app);
  const io = initializeSocketServer(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  const tokenA = jwt.sign({ id: context.agentUserId }, process.env.JWT_SECRET);
  const tokenB = jwt.sign({ id: context.agencyUserId }, process.env.JWT_SECRET);

  const invalidTokenError = await expectRejectedConnection(baseUrl, { token: "invalid" });
  const missingTokenError = await expectRejectedConnection(baseUrl, {});
  const socketA = await connectClient(baseUrl, tokenA, { userId: context.agencyUserId });
  const socketB = await connectClient(baseUrl, tokenB);
  const serverSocketA = io.sockets.sockets.get(socketA.id);
  const fakeUserIdIgnored = serverSocketA?.data.userId === context.agentUserId;

  const eventA = waitFor(socketA, "notification:new");
  const eventB = waitFor(socketB, "notification:new");
  const inquiry = await createInquiry(baseUrl, String(context.property._id), Date.now());
  const [payloadA, payloadB] = await Promise.all([eventA, eventB]);
  const notifications = await Notification.find({ inquiry: inquiry._id }).lean();
  const notificationA = notifications.find(
    (notification) => String(notification.recipient) === context.agentUserId,
  );
  const notificationB = notifications.find(
    (notification) => String(notification.recipient) === context.agencyUserId,
  );

  const notificationDeliveryIsolated =
    payloadA.id === String(notificationA?._id) &&
    payloadB.id === String(notificationB?._id) &&
    payloadA.id !== payloadB.id;
  const unreadBefore = await authenticatedRequest(
    baseUrl,
    context.agentUserId,
    "/api/v1/notifications/unread-count",
  );
  const read = await authenticatedRequest(
    baseUrl,
    context.agentUserId,
    `/api/v1/notifications/${notificationA._id}/read`,
    "PATCH",
  );
  const readPersisted = Boolean((await Notification.findById(notificationA._id).lean()).readAt);
  const foreignRead = await authenticatedRequest(
    baseUrl,
    context.agencyUserId,
    `/api/v1/notifications/${notificationA._id}/read`,
    "PATCH",
  );
  const archive = await authenticatedRequest(
    baseUrl,
    context.agentUserId,
    `/api/v1/notifications/${notificationA._id}/archive`,
    "PATCH",
  );
  const archivePersisted = Boolean((await Notification.findById(notificationA._id).lean()).archivedAt);

  socketA.disconnect();
  const offlineInquiry = await createInquiry(baseUrl, String(context.property._id), `${Date.now()}-offline`);
  const offlineNotification = await Notification.findOne({
    inquiry: offlineInquiry._id,
    recipient: context.agentUserId,
  }).lean();
  const reconnectedA = await connectClient(baseUrl, tokenA);
  const recoveredList = await authenticatedRequest(
    baseUrl,
    context.agentUserId,
    "/api/v1/notifications",
  );
  const offlineRecoveredByRest = recoveredList.body.notifications.some(
    (notification) => notification._id === String(offlineNotification._id),
  );

  const readAll = await authenticatedRequest(
    baseUrl,
    context.agentUserId,
    "/api/v1/notifications/read-all",
    "PATCH",
  );
  const offlineReadAfterReadAll = Boolean(
    (await Notification.findById(offlineNotification._id).lean()).readAt,
  );
  const agentReadAtBeforeForeignReadAll = (
    await Notification.findById(offlineNotification._id).lean()
  ).readAt;
  const foreignReadAll = await authenticatedRequest(
    baseUrl,
    context.agencyUserId,
    "/api/v1/notifications/read-all",
    "PATCH",
  );
  const agentReadAtAfterForeignReadAll = (
    await Notification.findById(offlineNotification._id).lean()
  ).readAt;
  const foreignReadAllIsIsolated = String(agentReadAtAfterForeignReadAll)
    === String(agentReadAtBeforeForeignReadAll);

  let replayDelivered = false;
  reconnectedA.once("notification:new", () => { replayDelivered = true; });
  const notificationCountBeforeReplay = await Notification.countDocuments({ inquiry: offlineInquiry._id });
  const replayResult = await eventBus.emitSafe(EVENTS.INQUIRY_CREATED, {
    eventId: `inquiry:${offlineInquiry._id}:created`,
    inquiryId: String(offlineInquiry._id),
    actorId: null,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const notificationCountAfterReplay = await Notification.countDocuments({ inquiry: offlineInquiry._id });

  console.log(JSON.stringify({
    socketAuthentication: {
      invalidTokenError,
      missingTokenError,
      fakeUserIdIgnored,
    },
    realtimeDelivery: {
      notificationCount: notifications.length,
      notificationDeliveryIsolated,
      payloadAId: payloadA.id,
      payloadBId: payloadB.id,
    },
    rest: {
      unreadStatus: unreadBefore.status,
      unreadCount: unreadBefore.body.unreadCount,
      readStatus: read.status,
      readPersisted,
      archiveStatus: archive.status,
      archivePersisted,
      foreignReadStatus: foreignRead.status,
      readAllStatus: readAll.status,
      readAllPersisted: offlineReadAfterReadAll,
      foreignReadAllStatus: foreignReadAll.status,
      foreignReadAllIsIsolated,
    },
    offlineRecovery: {
      notificationPersisted: Boolean(offlineNotification),
      offlineRecoveredByRest,
    },
    dedupeReplay: {
      replayResult,
      notificationCountBeforeReplay,
      notificationCountAfterReplay,
      replayDelivered,
    },
  }));

  socketB.disconnect();
  reconnectedA.disconnect();
  await io.close();
  await new Promise((resolve) => httpServer.close(resolve));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
