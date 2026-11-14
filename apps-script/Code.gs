/**
 * Macro Tracker – backend for the "Food Log" Google Sheet.
 *
 * The app sends a POST request with a JSON body like:
 *   { "action": "getDay", "token": "...", "date": "2026-11-14" }
 * and this script answers with JSON:
 *   { "ok": true, ... }   or   { "ok": false, "error": "..." }
 *
 * Actions: addMeal, getDay, getRange, setGoals, deleteMeal.
 *
 * Rules:
 * - Every request must carry the secret token stored in Script Properties
 *   under the name TOKEN. A wrong token gets { ok:false, error:"unauthorized" }.
 * - Writes are wrapped in a lock so two quick saves can't collide.
 * - Only the Log and Goals tabs are touched. The Daily tab is all formulas
 *   and is never written to.
 * - Times come from the phone's clock (the app sends "2026-11-14 12:35"),
 *   so they are stored exactly as the phone saw them, whatever the time zone.
 */

const LOG_SHEET = 'Log';
const GOALS_SHEET = 'Goals';
const LOG_COLUMNS = 14; // Log columns A..N

// Column positions in the Log tab (1 = column A).
const COL = {
  timestamp: 1, // A
  date: 2,      // B
  mealId: 3,    // C
  mealType: 4,  // D
  mealName: 5,  // E
  food: 6,      // F
  grams: 7,     // G
  kcal: 8,      // H
  protein: 9,   // I
  fat: 10,      // J
  carbs: 11,    // K
  source: 12,   // L
  confidence: 13, // M
  note: 14,     // N
};

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Every app request arrives here. */
function doPost(e) {
  let result;
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Empty request');
    const body = JSON.parse(e.postData.contents);
    checkToken_(body.token);
    result = route_(body);
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : String(err) };
  }
  return json_(result);
}

/** Opening the web app URL in a browser shows this. Handy to check the deployment. */
function doGet() {
  return json_({ ok: true, message: 'Macro Tracker backend is running. The app talks to it with POST.' });
}

/** Sends each action to its function. Writes run inside the lock. */
function route_(body) {
  switch (body.action) {
    case 'addMeal':    return withLock_(function () { return addMeal_(body); });
    case 'deleteMeal': return withLock_(function () { return deleteMeal_(body); });
    case 'setGoals':   return withLock_(function () { return setGoals_(body); });
    case 'getDay':     return getDay_(body);
    case 'getRange':   return getRange_(body);
    default: throw new Error('Unknown action: ' + body.action);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * addMeal – appends one row per food item.
 * Body: {
 *   meal:  { id, timestamp: "2026-11-14 12:35", type, name, source: "photo"|"manual", note },
 *   items: [ { name, grams, kcal, protein_g, fat_g, carbs_g, confidence } ]
 * }
 * Returns: { ok, mealId }
 */
function addMeal_(body) {
  const meal = body.meal || {};
  const items = body.items || [];

  if (!meal.id) throw new Error('Missing meal.id');
  checkTimestamp_(meal.timestamp);
  if (meal.source !== 'photo' && meal.source !== 'manual') throw new Error('meal.source must be photo or manual');
  if (!items.length) throw new Error('A meal needs at least one food item');

  const sheet = getSheet_(LOG_SHEET);

  // If this meal ID is already in the sheet (for example the app retried a
  // Save after a network hiccup), don't add it twice.
  if (findMealRows_(sheet, meal.id).length) {
    return { ok: true, mealId: meal.id, alreadySaved: true };
  }

  // Turn the phone's "2026-11-14 12:35" into real sheet dates.
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const timestamp = Utilities.parseDate(meal.timestamp, tz, 'yyyy-MM-dd HH:mm');
  const date = Utilities.parseDate(meal.timestamp.slice(0, 10), tz, 'yyyy-MM-dd');

  const rows = items.map(function (item) {
    if (!item.name) throw new Error('Every food item needs a name');
    return [
      timestamp,
      date,
      String(meal.id),
      String(meal.type || ''),
      String(meal.name || ''),
      String(item.name),
      round_(toNumber_(item.grams, 'grams'), 0),
      round_(toNumber_(item.kcal, 'kcal'), 0),
      round_(toNumber_(item.protein_g, 'protein_g'), 1),
      round_(toNumber_(item.fat_g, 'fat_g'), 1),
      round_(toNumber_(item.carbs_g, 'carbs_g'), 1),
      meal.source,
      String(item.confidence || ''), // blank for manual items
      String(meal.note || ''),
    ];
  });

  const start = sheet.getLastRow() + 1;
  const n = rows.length;

  // Text columns are set to plain text first, so a food called "1/2 apple"
  // is not turned into a date by Sheets.
  sheet.getRange(start, COL.mealId, n, COL.food - COL.mealId + 1).setNumberFormat('@');
  sheet.getRange(start, COL.source, n, COL.note - COL.source + 1).setNumberFormat('@');

  sheet.getRange(start, 1, n, LOG_COLUMNS).setValues(rows);

  sheet.getRange(start, COL.timestamp, n, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(start, COL.date, n, 1).setNumberFormat('yyyy-mm-dd');

  return { ok: true, mealId: meal.id };
}

/**
 * getDay – everything for one date.
 * Body: { date: "2026-11-14" }
 * Returns: { ok, date, meals: [...], totals, goals }
 */
function getDay_(body) {
  checkDate_(body.date, 'date');

  const rows = readLog_().filter(function (r) { return r.date === body.date; });

  // Group the item rows into meals, keeping the order they were saved in.
  const meals = [];
  const byId = {};
  rows.forEach(function (r) {
    let meal = byId[r.mealId];
    if (!meal) {
      meal = {
        id: r.mealId,
        timestamp: r.timestamp,
        time: r.timestamp.slice(11, 16), // "12:35"
        type: r.mealType,
        name: r.mealName,
        source: r.source,
        note: r.note,
        items: [],
      };
      byId[r.mealId] = meal;
      meals.push(meal);
    }
    meal.items.push({
      name: r.food,
      grams: r.grams,
      kcal: r.kcal,
      protein_g: r.protein_g,
      fat_g: r.fat_g,
      carbs_g: r.carbs_g,
      confidence: r.confidence,
    });
  });

  meals.forEach(function (m) { m.totals = sumTotals_(m.items); });
  meals.sort(function (a, b) { return a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0; });

  return {
    ok: true,
    date: body.date,
    meals: meals,
    totals: sumTotals_(rows),
    goals: readGoals_(),
  };
}

/**
 * getRange – daily totals between two dates (both included), newest first.
 * Only days that have something logged are returned.
 * Body: { from: "2026-11-07", to: "2026-11-13" }
 * Returns: { ok, days: [ { date, kcal, protein_g, fat_g, carbs_g, meals } ], goals }
 */
function getRange_(body) {
  checkDate_(body.from, 'from');
  checkDate_(body.to, 'to');

  const byDate = {};
  readLog_().forEach(function (r) {
    if (r.date < body.from || r.date > body.to) return;
    if (!byDate[r.date]) byDate[r.date] = { rows: [], mealIds: {} };
    byDate[r.date].rows.push(r);
    byDate[r.date].mealIds[r.mealId] = true;
  });

  const days = Object.keys(byDate).sort().reverse().map(function (date) {
    const t = sumTotals_(byDate[date].rows);
    return {
      date: date,
      kcal: t.kcal,
      protein_g: t.protein_g,
      fat_g: t.fat_g,
      carbs_g: t.carbs_g,
      meals: Object.keys(byDate[date].mealIds).length,
    };
  });

  return { ok: true, days: days, goals: readGoals_() };
}

/**
 * setGoals – writes the four daily goals into Goals!B2:B5.
 * Body: { goals: { kcal, protein_g, fat_g, carbs_g } }
 * Returns: { ok, goals }
 */
function setGoals_(body) {
  const g = body.goals || {};
  const values = [
    toNumber_(g.kcal, 'kcal'),
    toNumber_(g.protein_g, 'protein_g'),
    toNumber_(g.fat_g, 'fat_g'),
    toNumber_(g.carbs_g, 'carbs_g'),
  ];
  values.forEach(function (v) { if (v <= 0) throw new Error('Goals must be above 0'); });

  getSheet_(GOALS_SHEET).getRange('B2:B5').setValues(values.map(function (v) { return [round_(v, 0)]; }));
  return { ok: true, goals: readGoals_() };
}

/**
 * deleteMeal – removes every Log row with this meal ID.
 * Body: { mealId: "m-20261114-123512" }
 * Returns: { ok, deleted } (deleted = number of rows removed)
 */
function deleteMeal_(body) {
  if (!body.mealId) throw new Error('Missing mealId');
  const sheet = getSheet_(LOG_SHEET);
  const rowNumbers = findMealRows_(sheet, body.mealId);
  // Delete from the bottom up so the row numbers above stay correct.
  rowNumbers.sort(function (a, b) { return b - a; }).forEach(function (row) { sheet.deleteRow(row); });
  return { ok: true, deleted: rowNumbers.length };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Throws "unauthorized" unless the token matches the TOKEN script property. */
function checkToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected) throw new Error('TOKEN is not set in Script Properties');
  if (token !== expected) throw new Error('unauthorized');
}

/** Runs fn while holding the script lock (waits up to 10 s for it). */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Tab "' + name + '" not found');
  return sheet;
}

/** Reads every Log row (below the header) as a simple object. */
function readLog_() {
  const sheet = getSheet_(LOG_SHEET);
  const last = sheet.getLastRow();
  if (last < 2) return [];

  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const values = sheet.getRange(2, 1, last - 1, LOG_COLUMNS).getValues();

  return values
    .map(function (r, i) {
      if (r[COL.date - 1] === '') return null; // empty row, skipped below
      const at = function (col) { return r[col - 1]; };
      return {
        timestamp: toText_(at(COL.timestamp), tz, 'yyyy-MM-dd HH:mm'),
        date: toText_(at(COL.date), tz, 'yyyy-MM-dd').slice(0, 10),
        // Rows typed in by hand may have no meal ID; give them their own.
        mealId: String(at(COL.mealId) || 'row-' + (i + 2)),
        mealType: String(at(COL.mealType)),
        mealName: String(at(COL.mealName)),
        food: String(at(COL.food)),
        grams: Number(at(COL.grams)) || 0,
        kcal: Number(at(COL.kcal)) || 0,
        protein_g: Number(at(COL.protein)) || 0,
        fat_g: Number(at(COL.fat)) || 0,
        carbs_g: Number(at(COL.carbs)) || 0,
        source: String(at(COL.source)),
        confidence: String(at(COL.confidence)),
        note: String(at(COL.note)),
      };
    })
    .filter(function (r) { return r !== null; });
}

/** Row numbers (1-based, as in the sheet) of all Log rows with this meal ID. */
function findMealRows_(sheet, mealId) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const ids = sheet.getRange(2, COL.mealId, last - 1, 1).getValues();
  const rows = [];
  ids.forEach(function (r, i) { if (String(r[0]) === String(mealId)) rows.push(i + 2); });
  return rows;
}

/** Reads Goals!B2:B5. */
function readGoals_() {
  const v = getSheet_(GOALS_SHEET).getRange('B2:B5').getValues();
  return {
    kcal: Number(v[0][0]) || 0,
    protein_g: Number(v[1][0]) || 0,
    fat_g: Number(v[2][0]) || 0,
    carbs_g: Number(v[3][0]) || 0,
  };
}

/** Adds up kcal and macros of a list of items or rows. */
function sumTotals_(list) {
  const t = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
  list.forEach(function (x) {
    t.kcal += x.kcal;
    t.protein_g += x.protein_g;
    t.fat_g += x.fat_g;
    t.carbs_g += x.carbs_g;
  });
  return {
    kcal: round_(t.kcal, 0),
    protein_g: round_(t.protein_g, 1),
    fat_g: round_(t.fat_g, 1),
    carbs_g: round_(t.carbs_g, 1),
  };
}

/** A sheet date becomes text like "2026-11-14"; text stays text. */
function toText_(value, tz, format) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, format);
  return String(value).trim();
}

function toNumber_(value, name) {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || isNaN(n)) {
    throw new Error(name + ' must be a number');
  }
  return n;
}

function round_(n, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function checkDate_(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error(name + ' must look like 2026-11-14');
}

function checkTimestamp_(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(value))) {
    throw new Error('meal.timestamp must look like 2026-11-14 12:35');
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
