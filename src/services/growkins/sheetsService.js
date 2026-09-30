const { google } = require('googleapis');
const { getGoogleAuth } = require('./googleAuth');

const sheets = google.sheets('v4');

// In-memory cache for fast read operations
const cache = {
  data: {},
  timestamp: {},
  TTL_MS: 30 * 1000 // 30 seconds cache for reads
};

function getSpreadsheetId() {
  const id = process.env.GROWKINS_GOOGLE_SHEET_ID;
  if (!id) {
    throw new Error('GROWKINS_GOOGLE_SHEET_ID is not configured in .env!');
  }
  return id;
}

function invalidateCache(sheetTitle) {
  if (sheetTitle) {
    delete cache.data[sheetTitle];
    delete cache.timestamp[sheetTitle];
  } else {
    cache.data = {};
    cache.timestamp = {};
  }
}

// Automatically serialize/deserialize complex fields (JSON arrays or objects)
const JSON_FIELDS = new Set([
  'interests', 'benefits', 'materials', 'occasions',
  'whatsInside', 'playTips', 'inventory', 'images',
  'seo', 'items', 'timeline', 'gift', 'deliveryAddress',
  'customer', 'productIds'
]);

function serializeValue(key, val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

function deserializeValue(key, val) {
  if (val === undefined || val === null || val === '') return '';
  
  if (JSON_FIELDS.has(key)) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }

  // Boolean parsing
  if (val === 'TRUE' || val === 'true') return true;
  if (val === 'FALSE' || val === 'false') return false;

  // Number parsing (if strictly numeric)
  if (!isNaN(val) && val.trim() !== '' && (key.toLowerCase().includes('price') || key.toLowerCase().includes('count') || key.toLowerCase().includes('total') || key.toLowerCase().includes('fee') || key === 'rating' || key === 'sortOrder')) {
    return Number(val);
  }

  return val;
}

/**
 * Ensure worksheet exists with required headers.
 */
async function ensureWorksheet(sheetTitle, headers) {
  const auth = getGoogleAuth();
  const spreadsheetId = getSpreadsheetId();

  try {
    const meta = await sheets.spreadsheets.get({
      auth,
      spreadsheetId
    });

    const sheetExists = meta.data.sheets.some(
      s => s.properties.title.toLowerCase() === sheetTitle.toLowerCase()
    );

    if (!sheetExists) {
      // Add sheet
      await sheets.spreadsheets.batchUpdate({
        auth,
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetTitle }
              }
            }
          ]
        }
      });

      // Write header row
      if (headers && headers.length > 0) {
        await sheets.spreadsheets.values.update({
          auth,
          spreadsheetId,
          range: `${sheetTitle}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        });
      }
    }
  } catch (err) {
    console.error(`[GoogleSheets] Error ensuring worksheet ${sheetTitle}:`, err.message);
  }
}

/**
 * Read all rows from a sheet as an array of objects
 */
async function getAllRows(sheetTitle, forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cache.data[sheetTitle] && (now - cache.timestamp[sheetTitle] < cache.TTL_MS)) {
    return cache.data[sheetTitle];
  }

  const auth = getGoogleAuth();
  const spreadsheetId = getSpreadsheetId();

  try {
    const res = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: `${sheetTitle}!A:ZZ`
    });

    const rows = res.data.values || [];
    if (rows.length < 2) {
      cache.data[sheetTitle] = [];
      cache.timestamp[sheetTitle] = now;
      return [];
    }

    const headers = rows[0].map(h => String(h).trim());
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const obj = { _rowIndex: i + 1 }; // 1-based sheet row index
      headers.forEach((header, colIdx) => {
        const rawVal = row[colIdx] !== undefined ? row[colIdx] : '';
        obj[header] = deserializeValue(header, rawVal);
      });

      // Filter out empty rows without an ID or name
      if (obj.id || obj.name || obj.orderNumber) {
        data.push(obj);
      }
    }

    cache.data[sheetTitle] = data;
    cache.timestamp[sheetTitle] = now;
    return data;
  } catch (err) {
    console.error(`[GoogleSheets] Error fetching rows from ${sheetTitle}:`, err.message);
    throw err;
  }
}

/**
 * Append a new row to sheet
 */
async function appendRow(sheetTitle, rowData, defaultHeaders = []) {
  const auth = getGoogleAuth();
  const spreadsheetId = getSpreadsheetId();

  // Get current headers
  const res = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: `${sheetTitle}!1:1`
  });

  let headers = (res.data.values && res.data.values[0]) || [];

  if (headers.length === 0) {
    headers = defaultHeaders.length > 0 ? defaultHeaders : Object.keys(rowData);
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId,
      range: `${sheetTitle}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    });
  }

  const values = headers.map(header => serializeValue(header, rowData[header]));

  await sheets.spreadsheets.values.append({
    auth,
    spreadsheetId,
    range: `${sheetTitle}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [values]
    }
  });

  invalidateCache(sheetTitle);
  return rowData;
}

/**
 * Update an existing row matched by ID
 */
async function updateRow(sheetTitle, idKey, idValue, updateData) {
  const allRows = await getAllRows(sheetTitle, true);
  const targetIndex = allRows.findIndex(r => String(r[idKey]) === String(idValue));

  if (targetIndex === -1) {
    throw new Error(`Item with ${idKey} = "${idValue}" not found in ${sheetTitle}`);
  }

  const existingRow = allRows[targetIndex];
  const rowIndex = existingRow._rowIndex;
  const auth = getGoogleAuth();
  const spreadsheetId = getSpreadsheetId();

  // Get headers
  const res = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: `${sheetTitle}!1:1`
  });
  const headers = res.data.values[0];

  const merged = { ...existingRow, ...updateData };
  delete merged._rowIndex;

  const values = headers.map(header => serializeValue(header, merged[header]));

  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: `${sheetTitle}!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values]
    }
  });

  invalidateCache(sheetTitle);
  return merged;
}

/**
 * Delete a row by ID (clears or deletes row)
 */
async function deleteRow(sheetTitle, idKey, idValue) {
  const allRows = await getAllRows(sheetTitle, true);
  const target = allRows.find(r => String(r[idKey]) === String(idValue));

  if (!target) {
    throw new Error(`Item with ${idKey} = "${idValue}" not found in ${sheetTitle}`);
  }

  const rowIndex = target._rowIndex;
  const auth = getGoogleAuth();
  const spreadsheetId = getSpreadsheetId();

  // Get sheetId for batchUpdate deleteDimension
  const meta = await sheets.spreadsheets.get({ auth, spreadsheetId });
  const sheetObj = meta.data.sheets.find(
    s => s.properties.title.toLowerCase() === sheetTitle.toLowerCase()
  );

  if (!sheetObj) {
    throw new Error(`Sheet ${sheetTitle} not found`);
  }

  const numericSheetId = sheetObj.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: numericSheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }
      ]
    }
  });

  invalidateCache(sheetTitle);
  return { id: idValue, deleted: true };
}

module.exports = {
  getAllRows,
  appendRow,
  updateRow,
  deleteRow,
  ensureWorksheet,
  invalidateCache
};
