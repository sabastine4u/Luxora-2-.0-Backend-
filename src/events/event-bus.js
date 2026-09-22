const { EventEmitter } = require("events");
const EVENTS = require("./events");

const validEventNames = new Set(Object.values(EVENTS));

class EventBus extends EventEmitter {
  register(eventName, listener) {
    if (!validEventNames.has(eventName)) {
      throw new Error(`Cannot register unknown event: ${eventName}`);
    }

    if (typeof listener !== "function") {
      throw new TypeError("An event listener must be a function");
    }

    if (this.listeners(eventName).includes(listener)) {
      throw new Error(`Listener is already registered for event: ${eventName}`);
    }

    super.on(eventName, listener);
  }

  async emitSafe(eventName, payload) {
    if (!validEventNames.has(eventName)) {
      throw new Error(`Cannot emit unknown event: ${eventName}`);
    }

    const listeners = this.listeners(eventName);
    const results = await Promise.allSettled(
      listeners.map((listener) => Promise.resolve().then(() => listener(payload))),
    );
    const failures = results.filter((result) => result.status === "rejected");

    failures.forEach((result) => {
      console.error(`Event listener failed for ${eventName}:`, result.reason);
    });

    return {
      eventName,
      listenerCount: listeners.length,
      failures: failures.length,
    };
  }
}

module.exports = new EventBus();
