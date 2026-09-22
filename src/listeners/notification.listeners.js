const EVENTS = require("../events/events");
const notificationService = require("../services/notification.service");
const {
  resolveInquiryContext,
  toIdString,
} = require("../services/communication-context.service");

const handleInquiryCreated = async ({ eventId, inquiryId, actorId = null } = {}) => {
  if (!eventId || !inquiryId) {
    throw new Error("INQUIRY_CREATED requires stable eventId and inquiryId");
  }

  // Resolve current trusted relationships from the persisted Inquiry rather
  // than accepting recipient IDs supplied by an HTTP caller.
  const context = await resolveInquiryContext(inquiryId);
  const normalizedActorId = toIdString(actorId);
  const inquiryResourceId = toIdString(context.inquiry);
  const propertyResourceId = toIdString(context.propertyId);
  const recipientUserIds = context.notificationRecipientUserIds.filter(
    (recipientId) => recipientId !== normalizedActorId,
  );

  const results = await Promise.allSettled(
    recipientUserIds.map((recipientId) =>
      notificationService.createOrGetNotification({
        recipient: recipientId,
        actor: normalizedActorId,
        type: "inquiry_created",
        category: "communication",
        priority: "normal",
        title: "New property inquiry",
        body: "A new inquiry has been submitted for one of your assigned properties.",
        resourceType: "inquiry",
        resourceId: inquiryResourceId,
        inquiry: inquiryResourceId,
        property: propertyResourceId,
        dedupeKey: `inquiry:${inquiryResourceId}:created:${recipientId}`,
      }),
    ),
  );

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    failures.forEach((result) => {
      console.error(`INQUIRY_CREATED notification recipient failed (${eventId}):`, result.reason);
    });

    throw new Error(
      `INQUIRY_CREATED notification delivery failed for ${failures.length} recipient(s) (${eventId})`,
    );
  }

  return results.map((result) => result.value);
};

const registerNotificationListeners = (eventBus) => {
  eventBus.register(EVENTS.INQUIRY_CREATED, handleInquiryCreated);
};

module.exports = {
  registerNotificationListeners,
};
