import { parse, serialize } from "cookie";
import { SESSION_COOKIE, SESSION_DAUER_MS } from "./session.js";

export function leseSessionToken(req) {
  const cookies = parse(req.headers.cookie || "");
  return cookies[SESSION_COOKIE] || null;
}

export function setzeSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DAUER_MS / 1000,
    })
  );
}

export function loescheSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })
  );
}
