import { createClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "./lib/find-auth-user.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = required("SUPABASE_SECRET_KEY");
const siteUrl = new URL(required("MIZAN_SITE_URL"));
const email = required("MIZAN_ADMIN_EMAIL").toLowerCase();

const isLocalHost = siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1";
const allowsHttp = siteUrl.protocol === "http:" && isLocalHost;
if (siteUrl.protocol !== "https:" && !allowsHttp) {
  throw new Error("MIZAN_SITE_URL must use HTTPS outside local development.");
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let user = await findAuthUserByEmail(admin.auth.admin, email);
let createdByScript = false;

if (!user) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/set-password", siteUrl).toString(),
  });
  if (error || !data.user) {
    throw error ?? new Error("Supabase did not return the invited Admin user.");
  }
  user = data.user;
  createdByScript = true;
}

const { error: roleError } = await admin.auth.admin.updateUserById(user.id, {
  app_metadata: {
    ...user.app_metadata,
    role: "admin",
  },
});

if (roleError) {
  if (createdByScript) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(user.id);
    if (cleanupError) {
      throw new AggregateError(
        [roleError, cleanupError],
        "Failed to assign the Admin role and clean up the newly invited account.",
      );
    }
  }
  throw roleError;
}

console.log("Mizan Admin role assigned.");
console.log(
  createdByScript ? "An invitation was created for this Admin." : "The existing Auth user was promoted.",
);
