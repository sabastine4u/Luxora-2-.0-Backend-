const EVENTS = Object.freeze({
  INQUIRY_CREATED: "inquiry.created",
  MESSAGE_CREATED: "message.created",
  BOOKING_CREATED: "booking.created",
  BOOKING_CONFIRMED: "booking.confirmed",
  BOOKING_REJECTED: "booking.rejected",
  OFFER_CREATED: "offer.created",
  OFFER_ACCEPTED: "offer.accepted",
  OFFER_REJECTED: "offer.rejected",
  PROPERTY_ASSIGNED: "property.assigned",
  PROPERTY_APPROVED: "property.approved",
  PROPERTY_PUBLISHED: "property.published",
});

module.exports = EVENTS;
