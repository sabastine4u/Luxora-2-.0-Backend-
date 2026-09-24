const eventBus = require("./event-bus");
const { registerNotificationListeners } = require("../listeners/notification.listeners");
const { registerMessageListeners } = require("../listeners/message.listeners");

let registered = false;

const registerEventListeners = () => {
  if (registered) return;

  registerNotificationListeners(eventBus);
  registerMessageListeners(eventBus);
  registered = true;
};

module.exports = registerEventListeners;
