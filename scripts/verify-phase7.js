require("dotenv").config();

const { createServer } = require("http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../src/app");
const Inquiry = require("../src/models/inquiry.model");
const Conversation = require("../src/models/conversation.model");
const Message = require("../src/models/message.model");
const Notification = require("../src/models/notification.model");
const Property = require("../src/models/property.model");
const Agent = require("../src/models/agent.model");
const Agency = require("../src/models/agency.model");
const User = require("../src/models/user.model");
const eventBus = require("../src/events/event-bus");
const EVENTS = require("../src/events/events");

const request = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
};

const main = async () => {
  await mongoose.connect(process.env.DBSTRING);
  await Promise.all([Inquiry.init(), Conversation.init(), Message.init(), Notification.init()]);

  const properties = await Property.find({ status: "Published" }).select("_id agent agency").lean();
  let context;
  for (const property of properties) {
    if (!property.agent || !property.agency) continue;
    const [agent, agency] = await Promise.all([
      Agent.findById(property.agent).select("user status").lean(),
      Agency.findById(property.agency).select("user status").lean(),
    ]);
    if (agent?.user && agency?.user) {
      context = { property, agentUserId: String(agent.user), agencyUserId: String(agency.user) };
      break;
    }
  }
  if (!context) throw new Error("No eligible published property found");

  const buyers = await User.find({ isActive: true })
    .select("_id")
    .lean();
  const eligibleBuyers = buyers.filter((user) => ![
    context.agentUserId,
    context.agencyUserId,
  ].includes(String(user._id)));
  if (eligibleBuyers.length < 2) throw new Error("Two eligible active users are required");

  const buyerA = String(eligibleBuyers[0]._id);
  const buyerB = String(eligibleBuyers[1]._id);
  const tokenA = jwt.sign({ id: buyerA }, process.env.JWT_SECRET);
  const tokenB = jwt.sign({ id: buyerB }, process.env.JWT_SECRET);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const suffix = Date.now();
  const payload = {
    propertyId: String(context.property._id),
    fullName: "Phase Seven Verification",
    email: `phase7-${suffix}@luxora.com`,
    phone: "+2348000000007",
    message: "Phase 7 authenticated Contact Agent verification inquiry.",
    source: "Website",
  };

  const anonymous = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, email: `phase7-anonymous-${suffix}@luxora.com` }),
  });
  const anonymousInquiry = await Inquiry.findById(anonymous.body.inquiry?._id).lean();
  const anonymousConversationCount = await Conversation.countDocuments({ inquiry: anonymousInquiry?._id });

  const missingKey = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const invalidJwt = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: { Authorization: "Bearer invalid", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const spoofedIdentity = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "X-Idempotency-Key": `phase7-spoof-${suffix}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, inquirer: buyerB }),
  });

  const key = `phase7-${suffix}`;
  const authenticated = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "X-Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (authenticated.status !== 201) throw new Error(JSON.stringify(authenticated));
  const inquiryId = authenticated.body.inquiry._id;
  const conversationId = authenticated.body.conversation._id;
  const messageId = authenticated.body.initialMessage._id;
  const notificationCountBeforeRetry = await Notification.countDocuments({ inquiry: inquiryId });
  const retry = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "X-Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const notificationCountAfterRetry = await Notification.countDocuments({ inquiry: inquiryId });
  const differentPayload = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "X-Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, message: "Different request payload." }),
  });
  const otherUser = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "X-Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, email: `phase7-other-${suffix}@luxora.com` }),
  });

  const conversation = await Conversation.findById(conversationId).lean();
  const message = await Message.findById(messageId).lean();
  const propertyOwner = await Property.findById(context.property._id).select("owner").lean();

  // Controlled recovery checks operate only on the verification inquiry
  // created above.  They intentionally model an interrupted write chain.
  await Message.deleteMany({ conversation: conversationId });
  await Conversation.deleteOne({ _id: conversationId });
  const recoveryA = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "X-Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const recoveryAConversationId = recoveryA.body.conversation?._id;
  const recoveryAMessageCount = await Message.countDocuments({
    conversation: recoveryAConversationId,
    dedupeKey: `inquiry:${inquiryId}:initial-message`,
  });

  await Message.deleteMany({ conversation: recoveryAConversationId });
  const recoveryB = await request(baseUrl, "/api/v1/inquiries", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "X-Idempotency-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const recoveryBMessageCount = await Message.countDocuments({
    conversation: recoveryAConversationId,
    dedupeKey: `inquiry:${inquiryId}:initial-message`,
  });

  await eventBus.emitSafe(EVENTS.INQUIRY_CREATED, {
    eventId: `inquiry:${inquiryId}:created`,
    inquiryId,
    actorId: buyerA,
  });
  const notificationCountAfterReplay = await Notification.countDocuments({ inquiry: inquiryId });

  console.log(JSON.stringify({
    anonymous: {
      status: anonymous.status,
      inquirerIsNull: anonymousInquiry?.inquirer === null,
      conversationCount: anonymousConversationCount,
    },
    authFailures: {
      missingKeyStatus: missingKey.status,
      invalidJwtStatus: invalidJwt.status,
      spoofedIdentityStatus: spoofedIdentity.status,
    },
    authenticated: {
      status: authenticated.status,
      inquirerMatchesJwt: String(authenticated.body.inquiry.inquirer) === buyerA,
      conversationId,
      messageId,
      senderMatchesJwt: String(message?.sender) === buyerA,
      participants: conversation?.participants.map(String),
      ownerExcluded: !conversation?.participants.map(String).includes(String(propertyOwner.owner)),
      notificationCountBeforeRetry,
    },
    retry: {
      status: retry.status,
      sameInquiry: retry.body.inquiry?._id === inquiryId,
      sameConversation: retry.body.conversation?._id === conversationId,
      sameInitialMessage: retry.body.initialMessage?._id === messageId,
      notificationCountAfterRetry,
      notificationCountAfterReplay,
    },
    conflicts: {
      differentPayloadStatus: differentPayload.status,
      sameKeyDifferentUserStatus: otherUser.status,
      otherUserCreatedIndependentInquiry: otherUser.body.inquiry?._id !== inquiryId,
    },
    recovery: {
      conversationMissing: {
        status: recoveryA.status,
        sameInquiry: recoveryA.body.inquiry?._id === inquiryId,
        conversationId: recoveryAConversationId,
        conversationCreated: recoveryA.body.created?.conversation === true,
        initialMessageCreated: recoveryA.body.created?.initialMessage === true,
        initialMessageCount: recoveryAMessageCount,
      },
      initialMessageMissing: {
        status: recoveryB.status,
        sameInquiry: recoveryB.body.inquiry?._id === inquiryId,
        conversationId: recoveryB.body.conversation?._id,
        sameConversation: recoveryB.body.conversation?._id === recoveryAConversationId,
       conversationCreated: recoveryB.body.created?.conversation === true,
        initialMessageCreated: recoveryB.body.created?.initialMessage === true,
        initialMessageCount: recoveryBMessageCount,
      },
    },
  }));

  await new Promise((resolve) => server.close(resolve));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
