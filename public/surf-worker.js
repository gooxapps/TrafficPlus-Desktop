// TrafficPlus multi-slot surf timer worker
// Runs N parallel countdowns inside a Web Worker thread so timers survive
// background-tab throttling. Uses Date.now() deltas — never drifts even if
// setInterval is rate-limited by the browser.

const slots = new Map();

function clearSlotTimer(slot) {
  if (slot && slot.timer) {
    clearInterval(slot.timer);
    slot.timer = null;
  }
}

function tick(slotId) {
  const slot = slots.get(slotId);
  if (!slot || slot.pausedAt !== null) return;
  const elapsed = (Date.now() - slot.startedAt - slot.pausedTotal) / 1000;
  const remaining = Math.max(0, slot.duration - elapsed);
  postMessage({ type: 'tick', slotId, remaining: Math.ceil(remaining) });
  if (remaining <= 0) {
    clearSlotTimer(slot);
    slots.delete(slotId);
    postMessage({ type: 'complete', slotId });
  }
}

self.onmessage = function (e) {
  const data = e.data || {};
  const slotId = data.slotId;

  switch (data.type) {
    case 'start': {
      const existing = slots.get(slotId);
      if (existing) clearSlotTimer(existing);
      const slot = {
        startedAt: Date.now(),
        duration: data.duration || 15,
        pausedAt: null,
        pausedTotal: 0,
        timer: null,
      };
      slot.timer = setInterval(() => tick(slotId), 1000);
      slots.set(slotId, slot);
      tick(slotId);
      break;
    }
    case 'pause': {
      const slot = slots.get(slotId);
      if (slot && slot.pausedAt === null) slot.pausedAt = Date.now();
      break;
    }
    case 'resume': {
      const slot = slots.get(slotId);
      if (slot && slot.pausedAt !== null) {
        slot.pausedTotal += Date.now() - slot.pausedAt;
        slot.pausedAt = null;
      }
      break;
    }
    case 'stop': {
      const slot = slots.get(slotId);
      if (slot) {
        clearSlotTimer(slot);
        slots.delete(slotId);
      }
      break;
    }
    case 'pauseAll': {
      slots.forEach((slot) => {
        if (slot.pausedAt === null) slot.pausedAt = Date.now();
      });
      break;
    }
    case 'resumeAll': {
      slots.forEach((slot) => {
        if (slot.pausedAt !== null) {
          slot.pausedTotal += Date.now() - slot.pausedAt;
          slot.pausedAt = null;
        }
      });
      break;
    }
    case 'stopAll': {
      slots.forEach((slot) => clearSlotTimer(slot));
      slots.clear();
      break;
    }
  }
};
