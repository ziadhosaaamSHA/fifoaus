function parseNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`invalid cron value "${value}"`);
  }
  return parsed;
}

function expandSegment(segment, min, max) {
  const [base, stepText] = segment.split("/");
  const step = stepText === undefined ? 1 : parseNumber(stepText, 1, max - min + 1);
  const values = [];

  let start = min;
  let end = max;

  if (base !== "*") {
    if (base.includes("-")) {
      const [rangeStart, rangeEnd] = base.split("-");
      start = parseNumber(rangeStart, min, max);
      end = parseNumber(rangeEnd, min, max);
      if (start > end) {
        throw new Error(`invalid cron range "${base}"`);
      }
    } else {
      start = parseNumber(base, min, max);
      end = start;
    }
  }

  for (let value = start; value <= end; value += step) {
    values.push(value);
  }

  return values;
}

function parseField(field, min, max) {
  const values = new Set();

  for (const segment of field.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) {
      throw new Error("empty cron segment");
    }

    for (const value of expandSegment(trimmed, min, max)) {
      values.add(value);
    }
  }

  return (input) => values.has(input);
}

export function createCronMatcher(expression) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`invalid cron expression "${expression}"`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  const matchMinute = parseField(minute, 0, 59);
  const matchHour = parseField(hour, 0, 23);
  const matchDayOfMonth = parseField(dayOfMonth, 1, 31);
  const matchMonth = parseField(month, 1, 12);
  const matchDayOfWeek = parseField(dayOfWeek, 0, 6);

  return (date) =>
    matchMinute(date.getMinutes()) &&
    matchHour(date.getHours()) &&
    matchDayOfMonth(date.getDate()) &&
    matchMonth(date.getMonth() + 1) &&
    matchDayOfWeek(date.getDay());
}

function getMinuteKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0")
  ].join("-");
}

export function scheduleCronJob({ expression, name, task }) {
  const matches = createCronMatcher(expression);
  let stopped = false;
  let running = false;
  let lastMinuteKey = null;
  let timer = null;

  async function tick() {
    if (stopped) return;

    const now = new Date();
    const minuteKey = getMinuteKey(now);

    if (!running && minuteKey !== lastMinuteKey && matches(now)) {
      running = true;
      lastMinuteKey = minuteKey;

      try {
        await task({ scheduledAt: now });
      } catch (err) {
        console.error(`[cron:${name}] execution failed`, err);
      } finally {
        running = false;
      }
    }

    const delay = 60_000 - (Date.now() % 60_000) + 250;
    timer = setTimeout(tick, delay);
  }

  const initialDelay = 60_000 - (Date.now() % 60_000) + 250;
  timer = setTimeout(tick, initialDelay);

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  };
}
