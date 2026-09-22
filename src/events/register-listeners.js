const eventBus = require("./event-bus");
const { registerNotificationListeners } = require("../listeners/notification.listeners");

let registered = false;

const registerEventListeners = () => {
  if (registered) return;

  registerNotificationListeners(eventBus);
  registered = true;
};

module.exports = registerEventListeners;
