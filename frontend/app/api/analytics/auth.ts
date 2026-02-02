import { headers } from "next/headers";

const HEADER_CANDIDATES = [
  "x-forwarded-user",
  "x-authenticated-user",
  "x-user-email",
  "x-auth-email",
  "x-auth-request-email",
];

function getHeaderUserEmail() {
  const reqHeaders = headers();
  for (const header of HEADER_CANDIDATES) {
    const value = reqHeaders.get(header);
    if (value) {
      return value.split(",")[0]?.trim() ?? "";
    }
  }
  return "";
}

export function requireAdmin() {
  const allowPublic = process.env.ANALYTICS_PUBLIC === "true";
  if (allowPublic) {
    return { ok: true, email: "public" };
  }

  const allowNoHeader = process.env.ADMIN_ALLOW_NO_HEADER === "true";
  if (allowNoHeader && process.env.NODE_ENV !== "production") {
    return { ok: true, email: "local-dev" };
  }

  const allowListRaw = process.env.ADMIN_ALLOWED_EMAILS ?? "";
  const allowList = allowListRaw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length === 0) {
    return { ok: false, reason: "ADMIN_ALLOWED_EMAILS is not configured." };
  }

  const email = getHeaderUserEmail().toLowerCase();
  if (!email) {
    return { ok: false, reason: "No authenticated user header found." };
  }

  if (!allowList.includes(email)) {
    return { ok: false, reason: "User is not authorized for analytics dashboard." };
  }

  return { ok: true, email };
}
