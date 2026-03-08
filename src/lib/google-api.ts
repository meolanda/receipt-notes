const SETTINGS_KEY = "receipt-google-settings";
const TOKEN_KEY = "receipt-google-token";

export interface GoogleSettings {
  clientId: string;
  spreadsheetId: string;
  driveFolderId: string;
}

export interface GoogleToken {
  accessToken: string;
  expiresAt: number;
}

export function getGoogleSettings(): GoogleSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { clientId: "", spreadsheetId: "", driveFolderId: "" };
  } catch {
    return { clientId: "", spreadsheetId: "", driveFolderId: "" };
  }
}

export function saveGoogleSettings(settings: GoogleSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getGoogleToken(): GoogleToken | null {
  try {
    const data = localStorage.getItem(TOKEN_KEY);
    if (!data) return null;
    const token: GoogleToken = JSON.parse(data);
    if (Date.now() >= token.expiresAt) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function saveGoogleToken(token: GoogleToken): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function clearGoogleToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isGoogleConnected(): boolean {
  return getGoogleToken() !== null;
}

const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

export function startGoogleOAuth(): void {
  const settings = getGoogleSettings();
  if (!settings.clientId) {
    throw new Error("กรุณากรอก Google OAuth Client ID ก่อน");
  }

  const redirectUri = window.location.origin;
  const params = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: SCOPES,
    prompt: "consent",
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function handleOAuthCallback(): boolean {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return false;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get("access_token");
  const expiresIn = parseInt(params.get("expires_in") || "3600", 10);

  if (accessToken) {
    saveGoogleToken({
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    // Clean the hash
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  }
  return false;
}

function getAccessToken(): string {
  const token = getGoogleToken();
  if (!token) throw new Error("ยังไม่ได้เชื่อมต่อ Google Account");
  return token.accessToken;
}

export async function appendToSheet(spreadsheetId: string, values: string[][]): Promise<void> {
  const token = getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sheets API error: ${err.error?.message || res.statusText}`);
  }
}

export async function uploadToDrive(
  folderId: string,
  fileName: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const token = getAccessToken();

  // Convert base64 to blob
  const byteString = atob(base64Data.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive API error: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
}

import type { Receipt } from "./receipt-store";

export function receiptToSheetRow(receipt: Receipt, imageUrl?: string): string[] {
  const itemsJson = JSON.stringify(
    receipt.items.filter((i) => i.name).map((i) => ({
      name: i.name,
      qty: i.quantity,
      price: i.price,
    }))
  );

  return [
    receipt.date,
    receipt.profile === "personal" ? "ส่วนตัว" : "บริษัท",
    receipt.title,
    receipt.category,
    receipt.tag,
    receipt.project || "",
    itemsJson,
    receipt.totalAmount.toFixed(2),
    receipt.vatEnabled ? receipt.vatAmount.toFixed(2) : "0",
    receipt.grandTotal.toFixed(2),
    receipt.reimbursementNote || "",
    imageUrl || "",
    receipt.createdAt,
  ];
}

export async function syncReceiptToGoogle(receipt: Receipt): Promise<string | undefined> {
  const settings = getGoogleSettings();
  if (!settings.spreadsheetId) throw new Error("ยังไม่ได้ตั้ง Spreadsheet ID");

  let imageUrl: string | undefined;

  // Upload image if exists
  if (receipt.imageData && settings.driveFolderId) {
    const ext = receipt.imageData.startsWith("data:image/png") ? "png" : "jpg";
    const fileName = `${receipt.date}_${receipt.title.replace(/[^a-zA-Z0-9ก-๙]/g, "_")}.${ext}`;
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    imageUrl = await uploadToDrive(settings.driveFolderId, fileName, receipt.imageData, mimeType);
  }

  // Append row to sheet
  const row = receiptToSheetRow(receipt, imageUrl);
  await appendToSheet(settings.spreadsheetId, [row]);

  return imageUrl;
}
