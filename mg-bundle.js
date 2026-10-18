/* MG GAME HUB bundle (Supabase). One classic script so it also works from file:// (ZIP-to-APK apps). */
(function () {
"use strict";
var __defs = {}, __cache = {};
function __req(n) { if (!__cache[n]) __cache[n] = __defs[n](); return __cache[n]; }
function banner(t) {
  try {
    var b = document.getElementById("mg-err");
    if (!b) { b = document.createElement("div"); b.id = "mg-err"; b.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#b3202f;color:#fff;padding:10px 12px;border-radius:10px;font:13px/1.4 system-ui,sans-serif"; document.body.appendChild(b); }
    b.textContent = "Error: " + t;
  } catch (e) {}
}
window.addEventListener("error", function (e) { banner(e.message || "script error"); });
window.addEventListener("unhandledrejection", function (e) { banner((e.reason && (e.reason.message || e.reason.code)) || String(e.reason)); });
__defs["common.js"] = async function () {
const { sb, configured, notConfiguredReason } = await __req("supabase-init.js");
const { ADMIN_EMAIL, SUPABASE_URL, GOOGLE_LOGIN } = await __req("supabase-config.js");
const { CONTACT_EMAIL } = await __req("site-config.js");
let cur = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAdmin = (u) => !!u && u.emailVerified === true && (u.email || "").toLowerCase() === ADMIN_EMAIL;
const tsMillis = (t) => (t && t.toMillis ? t.toMillis() : 0);
const fmtDate = (t) => (t && t.toDate ? t.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
const fmtNum = (n) => Number(n || 0).toLocaleString();
function fmtSize(b) {
  if (!b) return "—";
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(b / 1024)) + " KB";
}
// Public Supabase Storage URLs. APKs live in the "apks" bucket, images in "media".
const bucketFor = (p) => (/\.apk$/i.test(p || "") ? "apks" : "media");
const mediaUrl = (path) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/${bucketFor(path)}/${String(path).split("/").map(encodeURIComponent).join("/")}` : "";

function toast(msg, type = "info") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast " + type; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}
const IN_APP = (() => { try { return !/^https?:$/.test(location.protocol) || /; wv\)/.test(navigator.userAgent) || /appassets\.androidplatform\.net/.test(location.hostname); } catch (e) { return false; } })();
const mapUser = (u) => (u ? { uid: u.id, email: u.email || "", emailVerified: !!u.email_confirmed_at } : null);
function watchAuth(cb) {
  if (!configured) { cb(null); return; }
  let first = true;
  const fire = (u) => setTimeout(() => cb(u), 0); // never call Supabase from inside its own auth callback
  sb.auth.onAuthStateChange((_e, s) => { first = false; fire(mapUser(s && s.user)); });
  sb.auth.getSession().then(({ data }) => { if (first) fire(mapUser(data.session && data.session.user)); }).catch(() => { if (first) fire(null); });
}
async function signInGoogle() {
  if (IN_APP) { toast("Google sign-in doesn't work inside the app (Google blocks it). Browsing and downloading work without an account. To log in, open the website in Chrome.", "error"); return null; }
  if (!GOOGLE_LOGIN) { location.href = "admin.html"; return null; }
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } });
  if (error) throw new Error(/not enabled|unsupported provider/i.test(error.message || "") ? "Google login isn't turned on yet. Site owner: use the admin page and choose “Email me a login link”." : error.message);
  return null;
}
const signOutUser = () => sb.auth.signOut();
function showConfigNotice(el) {
  el.innerHTML = notConfiguredReason === "library"
    ? `<div class="banner bad"><b>Couldn't load the Supabase library.</b> Check your internet connection and reload.</div>`
    : `<div class="banner warn"><b>Supabase isn't configured yet.</b> Open <code>supabase-config.js</code> and paste your project URL and key.</div>`;
}
async function loadFavorites(uid) {
  try { const { data, error } = await sb.from("favorites").select("game_id"); if (error) throw error; return new Set((data || []).map((r) => r.game_id)); } catch { return new Set(); }
}
async function setFavorite(uid, id, on) {
  const r = on ? await sb.from("favorites").insert({ user_id: uid, game_id: id }) : await sb.from("favorites").delete().eq("game_id", id).eq("user_id", uid);
  if (r.error) throw r.error;
}

const SEARCH_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
function renderChrome(active = "") {
  if (!document.querySelector(".bg")) document.body.insertAdjacentHTML("afterbegin", `<div class="bg" aria-hidden="true"><i></i><i></i></div>`);
  const tab = (k, href, label) => `<a href="${href}"${active === k ? ' class="on" aria-current="page"' : ""}>${label}</a>`;
  const h = document.getElementById("site-header");
  if (h) h.innerHTML = `
  <header class="site-header">
    <div class="wrap bar">
      <a class="brand" href="index.html"><img src="logo.svg" width="40" height="40" alt=""><span class="brand-name"><b>MG GAME HUB</b><small>MGCOWBELL / MGTECH</small></span></a>
      <form class="searchbar" action="browse.html" method="get" role="search">
        <input type="search" name="q" placeholder="Search apps &amp; games" aria-label="Search apps and games" autocomplete="off">
        <button type="submit" aria-label="Search">${SEARCH_SVG}</button>
      </form>
      <div class="head-actions">
        <a id="admin-link" class="btn btn-ghost btn-sm" href="admin.html" hidden>Admin</a>
        <button id="auth-btn" class="btn btn-ghost btn-sm" type="button">Login</button>
      </div>
    </div>
    <nav class="wrap tabs" aria-label="Sections">
      ${tab("home", "index.html", "Home")}${tab("games", "browse.html?type=game", "Games")}${tab("apps", "browse.html?type=app", "Apps")}${tab("categories", "browse.html?view=categories", "Categories")}${tab("top", "browse.html?sort=top", "Top Downloads")}
    </nav>
  </header>`;
  const f = document.getElementById("site-footer");
  if (f) f.innerHTML = `
  <footer class="site-footer"><div class="wrap">
    <nav class="foot-links" aria-label="Footer"><a href="info.html?p=about">About</a><a href="info.html?p=contact">Contact</a><a href="info.html?p=privacy">Privacy Policy</a><a href="info.html?p=terms">Terms of Use</a><a href="mailto:${esc(CONTACT_EMAIL)}?subject=${encodeURIComponent("Report abuse - MG GAME HUB")}">Report abuse</a></nav>
    <p class="foot-note">Android may warn you when installing apps from outside Google Play. Only install apps you trust.</p>
    <p>© 2026 MG GAME HUB | Powered by MGTECH.</p>
  </div></footer>`;
  const authBtn = document.getElementById("auth-btn");
  authBtn?.addEventListener("click", async () => {
    if (IN_APP) return signInGoogle();
    if (!configured) return toast("Supabase isn't configured yet.", "error");
    try { cur ? await signOutUser() : await signInGoogle(); } catch (e) { toast("Sign-in failed: " + (e.message || e.code), "error"); }
  });
  watchAuth((u) => {
    cur = u;
    if (authBtn) authBtn.textContent = u ? "Sign out" : "Login";
    const l = document.getElementById("admin-link"); if (l) l.hidden = !isAdmin(u); // cosmetic only; rules enforce admin
  });
}

function tileHTML(g) {
  const icon = g.iconPath ? `<img src="${esc(mediaUrl(g.iconPath))}" width="96" height="96" loading="lazy" decoding="async" alt="">` : `<span class="ph">${esc((g.name || "?")[0])}</span>`;
  return `<a class="tile" href="game.html?id=${encodeURIComponent(g.id)}"><span class="tile-icon">${icon}</span>
    <span class="tile-name">${esc(g.name)}</span>
    <span class="tile-meta">${esc(g.category)} · ${fmtSize(g.apkSize)}</span>
    ${(g.downloads || 0) > 0 ? `<span class="tile-meta">⬇ ${fmtNum(g.downloads)}</span>` : ""}</a>`;
}
function slideHTML(g) {
  const img = g.bannerPath || g.coverPath;
  return `<a class="slide" href="game.html?id=${encodeURIComponent(g.id)}">
    ${img ? `<img src="${esc(mediaUrl(img))}" decoding="async" alt="">` : g.iconPath ? `<img class="slide-icon" src="${esc(mediaUrl(g.iconPath))}" decoding="async" alt="">` : ""}
    <span class="slide-info"><b>${esc(g.name)}</b><small>${esc(g.shortDescription || g.category)}</small></span><span class="btn btn-primary btn-sm">Get</span></a>`;
}
const skeletonTiles = (n = 6) => Array.from({ length: n }, () => `<div class="tile sk-tile" aria-hidden="true"><span class="tile-icon sk"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span></div>`).join("");

return { esc, isAdmin, tsMillis, fmtDate, fmtNum, fmtSize, bucketFor, mediaUrl, toast, IN_APP, watchAuth, signInGoogle, signOutUser, showConfigNotice, loadFavorites, setFavorite, renderChrome, tileHTML, slideHTML, skeletonTiles };
};
__defs["game.js"] = async function () {
const { IN_APP, renderChrome, watchAuth, esc, fmtSize, fmtDate, fmtNum, mediaUrl, toast, showConfigNotice, loadFavorites, setFavorite } = await __req("common.js");
const { configured, sb } = await __req("supabase-init.js");
const { CONTACT_EMAIL } = await __req("site-config.js");
const { fromRow } = await __req("data.js");

renderChrome("");
const root = document.getElementById("game");
const id = new URLSearchParams(location.search).get("id");
let game = null, user = null, favs = new Set();
const notFound = (msg) => (root.innerHTML = `<div class="empty"><b>${esc(msg)}</b><p><a class="btn btn-primary" href="index.html">Back to home</a></p></div>`);

function render() {
  const g = game, verified = g.apkVerified === true;
  document.title = `${g.name} – MG GAME HUB`;
  const shots = (g.screenshotPaths || []).map((p) => `<a href="${esc(mediaUrl(p))}" target="_blank" rel="noopener"><img src="${esc(mediaUrl(p))}" loading="lazy" decoding="async" alt="Screenshot of ${esc(g.name)}"></a>`).join("");
  const mail = `mailto:${encodeURIComponent(CONTACT_EMAIL)}?subject=${encodeURIComponent("Report: " + g.name)}&body=${encodeURIComponent("I want to report this listing: " + location.href + "\n\nReason:\n")}`;
  const row = (k, v) => (v ? `<tr><th scope="row">${k}</th><td>${v}</td></tr>` : "");
  root.innerHTML = `
  <a class="back" href="index.html">← Home</a>
  <article class="detail">
    <div class="detail-head">
      ${g.iconPath ? `<img class="icon-lg" src="${esc(mediaUrl(g.iconPath))}" width="104" height="104" alt="${esc(g.name)} icon">` : `<span class="icon-lg ph">${esc((g.name || "?")[0])}</span>`}
      <div><h1>${esc(g.name)}</h1><p class="dev">MGCOWBELL / MGTECH</p><span class="chip">${esc(g.category)}</span> <span class="chip">${g.type === "app" ? "App" : "Game"}</span></div>
    </div>
    <div class="stat-row">
      <div><b>${fmtNum(g.downloads)}</b><span>Downloads recorded</span></div>
      <div><b>${fmtSize(g.apkSize)}</b><span>File size</span></div>
      <div><b>${esc(g.version)}</b><span>Version</span></div>
      <div><b>${verified && g.minSdk ? esc(g.minAndroid || "") : esc(g.minAndroid || "—")}</b><span>${verified ? "Min Android (verified)" : "Min Android"}</span></div>
    </div>
    <button id="dl" class="btn btn-primary btn-xl" type="button">DOWNLOAD APK</button>
    <div id="dl-msg" role="status" class="dl-msg"></div>
    <button id="fav" class="btn btn-ghost btn-sm" type="button" hidden></button>
    ${shots ? `<h2>Screenshots</h2><div class="shots">${shots}</div>` : ""}
    <h2>About this ${g.type === "app" ? "app" : "game"}</h2>
    <p class="prewrap">${esc(g.description || g.shortDescription || "")}</p>
    <h2>App info</h2>
    <table class="info-table"><tbody>
      ${row("Version", esc(g.version))}${row("Last updated", fmtDate(g.updatedAt))}${row("Released", fmtDate(g.publishedAt))}${row("File size", fmtSize(g.apkSize))}
      ${row("Category", esc(g.category))}${row("Minimum Android", esc(g.minAndroid || "Not specified") + (verified ? " (read from the APK)" : " (reported by publisher, not verified)"))}
      ${verified && g.packageName ? row("Package name", `<span class="mono">${esc(g.packageName)}</span>`) : ""}
      ${verified && g.apkSha256 ? row("SHA-256", `<span class="mono">${esc(g.apkSha256)}</span>`) : ""}
      ${row("Downloads recorded", fmtNum(g.downloads) + ` <span class="muted small">(download requests, not unique users)</span>`)}
    </tbody></table>
    <h2>How to install</h2>
    <ol class="steps"><li>Tap <b>DOWNLOAD APK</b> and wait for the file to finish.</li><li>Open the downloaded file. If Android asks, allow your browser to install apps from this source.</li><li>Tap <b>Install</b>, then open it.</li></ol>
    ${g.instructions ? `<p class="prewrap note">${esc(g.instructions)}</p>` : ""}
    <p class="safety"><b>Before you install:</b> Android shows a warning for apps that don't come from Google Play. ${verified ? "The server confirmed this file is a valid APK package with the details above. That is not a virus or malware scan." : "This file has not been checked by the server."} MG GAME HUB has not scanned it for malware, so install only apps you trust.
    <br><a href="${mail}">Report a problem with this listing</a></p>
  </article>`;
  document.getElementById("dl").addEventListener("click", download);
  document.getElementById("fav").addEventListener("click", toggleFav);
  renderFav();
}
function renderFav() {
  const b = document.getElementById("fav"); if (!b) return;
  b.hidden = !user; b.textContent = favs.has(game.id) ? "★ Saved to favorites" : "☆ Save to favorites";
}
async function toggleFav() {
  const on = !favs.has(game.id);
  try { await setFavorite(user.uid, game.id, on); on ? favs.add(game.id) : favs.delete(game.id); renderFav(); }
  catch { toast("Couldn't update favorites. Try again.", "error"); }
}

async function download() {
  const btn = document.getElementById("dl"), msg = document.getElementById("dl-msg");
  btn.disabled = true; msg.className = "dl-msg"; msg.textContent = "Preparing your download…";
  try {
    const { data: row, error: e1 } = await sb.from("games").select("id,published,apk_path").eq("id", game.id).maybeSingle(); // 1. still published?
    if (e1) throw e1;
    if (!row || row.published !== true || !row.apk_path) throw new Error("unavailable");
    let path = row.apk_path, counted = false;
    try { const r = await sb.rpc("record_download", { p_game: game.id }); if (r.error) throw r.error; if (r.data) path = r.data; counted = true; } // 2. count it
    catch (e) { console.warn("Download not counted:", e); }
    const url = mediaUrl(path) + "?download=" + encodeURIComponent(String(game.name || "app").replace(/[^\w.-]+/g, "-") + "-v" + String(game.version || "1").replace(/[^\w.-]+/g, "-") + ".apk");
    try { // 3. make sure the file exists (skipped silently if the browser blocks the check)
      const head = await fetch(url, { method: "HEAD" });
      if (head.status === 404) throw new Error("missing");
      if (head.status === 401 || head.status === 403) throw new Error("denied");
    } catch (e) { if (e.message === "missing" || e.message === "denied") throw e; }
    const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); // 4. start download
    msg.className = "dl-msg ok"; msg.textContent = "Your download has started. Open the file when it finishes to install.";
    if (IN_APP) { // an app WebView can't always start downloads itself, so offer a fallback
      msg.innerHTML = `Download requested. If nothing happens, <a href="${esc(url)}" target="_blank" rel="noopener">tap here to open the download link</a> or <button class="link" id="copy-dl" type="button">copy the link</button> and paste it in Chrome.`;
      document.getElementById("copy-dl").onclick = () => { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); toast("Link copied. Paste it in Chrome.", "ok"); } catch (e) { toast(url); } t.remove(); };
    }
    if (counted) game.downloads = (game.downloads || 0) + 1;
  } catch (e) {
    msg.className = "dl-msg bad";
    msg.textContent = ["unavailable", "denied"].includes(e.message) ? "This download isn't available right now. Please try again later."
      : e.message === "missing" ? "The file for this app is missing. Please report it using the link below, or try again later."
      : "Download failed. Check your internet connection and tap DOWNLOAD APK to try again.";
  } finally { btn.disabled = false; }
}

if (!configured) { showConfigNotice(document.getElementById("notice")); root.innerHTML = ""; }
else if (!id) notFound("No app selected.");
else {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound("This app isn't available.");
  else sb.from("games").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
    if (error) throw error;
    if (!data || data.published !== true) return notFound("This app isn't available.");
    game = fromRow(data); render();
  }).catch((e) => { console.error(e); notFound("Couldn't load this app. Check your connection and try again."); });
  watchAuth(async (u) => { user = u; favs = u ? await loadFavorites(u.uid) : new Set(); if (game) renderFav(); });
}

return {  };
};
__defs["browse.js"] = async function () {
const { renderChrome, tileHTML, skeletonTiles, esc, showConfigNotice, watchAuth, loadFavorites } = await __req("common.js");
const { configured, sb } = await __req("supabase-init.js");
const { fetchPage, searchGames, countByCategory, fromRow } = await __req("data.js");
const { CATEGORIES } = await __req("site-config.js");

const $ = (id) => document.getElementById(id);
const p = new URLSearchParams(location.search);
const S = {
  type: ["game", "app"].includes(p.get("type")) ? p.get("type") : "",
  cat: CATEGORIES.includes(p.get("cat")) ? p.get("cat") : "",
  sort: p.get("sort") === "top" ? "top" : "newest",
  q: (p.get("q") || "").trim(), view: p.get("view") || ""
};
const url = (o = {}) => {
  const n = { ...S, ...o }, u = new URLSearchParams();
  if (n.type) u.set("type", n.type); if (n.cat) u.set("cat", n.cat); if (n.sort === "top") u.set("sort", "top");
  if (n.q) u.set("q", n.q); if (n.view) u.set("view", n.view);
  const s = u.toString(); return "browse.html" + (s ? "?" + s : "");
};
const catsView = S.view === "categories" && !S.cat && !S.q;
const active = S.q ? "" : catsView ? "categories" : S.sort === "top" ? "top" : S.type === "game" ? "games" : S.type === "app" ? "apps" : "";
renderChrome(active);
const typeWord = S.type === "game" ? "Games" : S.type === "app" ? "Apps" : "Games & apps";
$("title").textContent = S.q ? `Results for “${S.q}”` : S.view === "favorites" ? "My favorites" : catsView ? "Categories" : S.sort === "top" ? "Top downloads" : S.cat ? `${S.cat} · ${typeWord}` : typeWord;
document.title = $("title").textContent + " – MG GAME HUB";

let cursor = null, done = false, busy = false, local = null, shown = 0;
const PAGE = 24;

function controls(counts) {
  const chip = (href, label, on) => `<a class="chip-btn${on ? " on" : ""}" href="${href}"${on ? ' aria-current="true"' : ""}>${esc(label)}</a>`;
  let h = `<div class="chips" aria-label="Type">${chip(url({ type: "", view: "" }), "All", !S.type)}${chip(url({ type: "game", view: "" }), "Games", S.type === "game")}${chip(url({ type: "app", view: "" }), "Apps", S.type === "app")}</div>`;
  const cats = CATEGORIES.filter((c) => counts[c] > 0);
  if (cats.length) h += `<div class="chips" aria-label="Category">${chip(url({ cat: "", view: "" }), "All categories", !S.cat)}${cats.map((c) => chip(url({ cat: c, view: "" }), c, S.cat === c)).join("")}</div>`;
  h += `<div class="chips" aria-label="Sort">${chip(url({ sort: "newest" }), "Newest", S.sort === "newest")}${chip(url({ sort: "top" }), "Most downloaded", S.sort === "top")}</div>`;
  $("controls").innerHTML = h;
}
function setStatus(html) { $("status").innerHTML = html; }
function emptyMsg() {
  const t = S.sort === "top" ? "No downloads have been recorded yet." : S.q ? "No apps match your search." : "Nothing here yet.";
  setStatus(`<div class="empty"><b>${t}</b><p class="muted">${S.q ? "Try a different word or browse the categories." : "Check back soon."}</p></div>`);
}
function errorMsg(e) {
  console.error(e);
  setStatus(`<div class="banner bad">Couldn't load apps (${esc(e.code || e.message)}). <button class="link" id="retry" type="button">Try again</button></div>`);
  $("retry").addEventListener("click", () => { setStatus(""); loadMore(true); });
}
const append = (items) => { $("results").insertAdjacentHTML("beforeend", items.map(tileHTML).join("")); };

async function loadMore(first = false) {
  if (busy || done) return; busy = true; $("more").hidden = true;
  if (first) $("results").innerHTML = skeletonTiles(12);
  try {
    let items;
    if (local) { items = local.slice(shown, shown + PAGE); shown += items.length; done = shown >= local.length; }
    else { const r = await fetchPage({ type: S.type, category: S.cat, sort: S.sort, cursor }); items = r.items; cursor = r.cursor; done = r.done; }
    if (first) $("results").innerHTML = "";
    append(items);
    if (first && !items.length) emptyMsg();
    $("more").hidden = done || !items.length;
  } catch (e) { if (first) $("results").innerHTML = ""; errorMsg(e); }
  busy = false;
}

async function start() {
  const counts = await countByCategory().catch(() => ({}));
  controls(counts);
  if (catsView) {
    $("cat-view").hidden = false;
    const cats = CATEGORIES.filter((c) => counts[c] > 0);
    $("cat-view").innerHTML = cats.length ? cats.map((c) => `<a class="cat-tile" href="${url({ cat: c, view: "" })}">${esc(c)}<small>${counts[c]} ${counts[c] === 1 ? "item" : "items"}</small></a>`).join("") : `<div class="empty"><b>No categories yet.</b><p>Categories appear once apps are published.</p></div>`;
    return;
  }
  if (S.view === "favorites") return favorites();
  if (S.q) {
    $("results").innerHTML = skeletonTiles(12);
    try {
      let list = await searchGames(S.q);
      list = list.filter((g) => (!S.type || g.type === S.type) && (!S.cat || g.category === S.cat));
      if (S.sort === "top") list = list.filter((g) => (g.downloads || 0) > 0).sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      local = list; shown = 0; $("results").innerHTML = "";
      if (!list.length) return emptyMsg();
    } catch (e) { $("results").innerHTML = ""; return errorMsg(e); }
  }
  await loadMore(true);
}
async function favorites() {
  watchAuth(async (u) => {
    if (!u) { $("results").innerHTML = ""; return setStatus(`<div class="empty"><b>Log in to see your favorites.</b></div>`); }
    $("results").innerHTML = skeletonTiles(6);
    const ids = [...(await loadFavorites(u.uid))];
    let list = [];
    if (ids.length) { const { data } = await sb.from("games").select("*").in("id", ids).eq("published", true); list = (data || []).map(fromRow); }
    $("results").innerHTML = "";
    list.length ? append(list) : setStatus(`<div class="empty"><b>No favorites yet.</b><p class="muted">Open an app and tap “Save to favorites”.</p></div>`);
  });
}

$("more").addEventListener("click", () => loadMore());
if ("IntersectionObserver" in window) new IntersectionObserver((e) => { if (e[0].isIntersecting && !busy && !done && $("results").children.length) loadMore(); }, { rootMargin: "400px" }).observe($("sentinel"));
if (!configured) showConfigNotice($("notice")); else start();

return {  };
};
__defs["app.js"] = async function () {
window.__mgReady = true;
const { signInGoogle, renderChrome, watchAuth, tileHTML, slideHTML, skeletonTiles, esc, showConfigNotice, isAdmin } = await __req("common.js");
const { configured } = await __req("supabase-init.js");
const { fetchPage, fetchFeatured, countByCategory } = await __req("data.js");
const { CATEGORIES } = await __req("site-config.js");

renderChrome("home");
const $ = (id) => document.getElementById(id);
const hideSplash = () => { $("splash").classList.add("hide"); try { sessionStorage.setItem("mghub_splash", "1"); } catch { /* ignore */ } };

function setRow(id, items) {
  const sec = $(id + "-sec");
  sec.hidden = !items.length;
  $(id).innerHTML = items.map(tileHTML).join("");
}
function carousel(items) {
  const sec = $("featured-sec");
  if (!items.length) { sec.hidden = true; return; }
  sec.hidden = false;
  const slides = $("slides"), dots = $("dots");
  slides.innerHTML = items.map(slideHTML).join("");
  dots.innerHTML = items.length > 1 ? items.map((_, i) => `<button type="button" aria-label="Show featured item ${i + 1}"></button>`).join("") : "";
  const els = [...slides.children]; let idx = 0;
  const mark = () => [...dots.children].forEach((d, k) => d.classList.toggle("on", k === idx));
  const go = (i) => { idx = (i + els.length) % els.length; els[idx].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); mark(); };
  slides.addEventListener("scroll", () => {
    const c = slides.scrollLeft + slides.clientWidth / 2; let best = 0, bd = 1e9;
    els.forEach((e, k) => { const d = Math.abs(e.offsetLeft - slides.offsetLeft + e.clientWidth / 2 - c); if (d < bd) { bd = d; best = k; } });
    if (best !== idx) { idx = best; mark(); }
  }, { passive: true });
  dots.onclick = (e) => { const k = [...dots.children].indexOf(e.target); if (k >= 0) go(k); };
  mark();
  if (els.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const t = setInterval(() => go(idx + 1), 5000);
    ["pointerdown", "mouseenter", "focusin"].forEach((ev) => slides.addEventListener(ev, () => clearInterval(t), { once: true }));
  }
}

async function load() {
  $("load-error").innerHTML = ""; $("empty").hidden = true;
  ["recent", "games", "apps", "popular"].forEach((id) => { $(id + "-sec").hidden = false; $(id).innerHTML = skeletonTiles(7); });
  $("featured-sec").hidden = false; $("slides").innerHTML = `<div class="slide sk" aria-hidden="true"></div>`; $("dots").innerHTML = "";
  $("cats-sec").hidden = true;
  const [feat, recent, games, apps, top, counts] = await Promise.allSettled([
    fetchFeatured(), fetchPage({ size: 12 }), fetchPage({ type: "game", size: 12 }), fetchPage({ type: "app", size: 12 }), fetchPage({ sort: "top", size: 12 }), countByCategory()
  ]);
  const val = (r) => (r.status === "fulfilled" ? r.value : null);
  const failed = [feat, recent, games, apps, top].filter((r) => r.status === "rejected");
  carousel(val(feat) || []);
  setRow("recent", (val(recent) || {}).items || []);
  setRow("games", (val(games) || {}).items || []);
  setRow("apps", (val(apps) || {}).items || []);
  setRow("popular", (val(top) || {}).items || []);
  const c = val(counts) || {};
  const cats = CATEGORIES.filter((k) => c[k] > 0);
  $("cats-sec").hidden = !cats.length;
  $("cats").innerHTML = cats.map((k) => `<a class="cat-tile" href="browse.html?cat=${encodeURIComponent(k)}">${esc(k)}<small>${c[k]} ${c[k] === 1 ? "item" : "items"}</small></a>`).join("");
  if (failed.length) {
    console.error(failed[0].reason);
    $("load-error").innerHTML = `<div class="banner bad">Couldn't load everything (${esc(failed[0].reason.code || failed[0].reason.message)}). Check your connection and <button class="link" id="retry" type="button">try again</button>.</div>`;
    $("retry").addEventListener("click", load);
  } else if (!(val(recent) || {}).items?.length) $("empty").hidden = false;
  hideSplash();
}

if (!configured) { showConfigNotice($("notice")); ["featured", "recent", "games", "apps", "popular", "cats"].forEach((id) => ($(id + "-sec").hidden = true)); hideSplash(); }
else load();

// ---------- welcome / registration screen ----------
const W = $("welcome");
const closeWelcome = () => { W.hidden = true; try { localStorage.setItem("mghub_welcome", "1"); } catch { /* ignore */ } };
$("w-skip").addEventListener("click", closeWelcome);
$("w-login").addEventListener("click", async () => {
  $("w-msg").textContent = "";
  if (!configured) { $("w-msg").textContent = "Login isn't set up yet: the Supabase settings in supabase-config.js haven't been added. Tap Skip to continue."; return; }
  try {
    const r = await signInGoogle();
    if (r && r.user) { closeWelcome(); if (isAdmin(r.user)) location.href = "admin.html"; }
  } catch (e) { $("w-msg").textContent = "Login failed: " + (e.message || e.code) + ". You can still skip."; }
});
watchAuth((u) => { $("post-btn").hidden = !isAdmin(u); if (u) W.hidden = true; });

return {  };
};
__defs["info.js"] = async function () {
const { renderChrome, esc } = await __req("common.js");
const { CONTACT_EMAIL } = await __req("site-config.js");
renderChrome("");
const mail = `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`;
const PAGES = {
  about: ["About MG GAME HUB", `
    <p>MG GAME HUB is a download site for Android games and apps published by MGCOWBELL / MGTECH. Everything listed here was uploaded by the site owner.</p>
    <h2>How downloads work</h2>
    <p>You don't need an account to browse or download. Apps are APK files, which are installed directly instead of through Google Play. Android will show a warning when you install an APK from outside Google Play. Only install apps you trust.</p>
    <h2>About the files</h2>
    <p>Every file here was uploaded by the site owner. <b>We do not scan apps for viruses or malware</b> and we do not claim that any app is safe. Only install apps you trust.</p>`],
  contact: ["Contact", `
    <p>Questions, feedback, or problems with a download: ${mail}</p>
    <h2>Report abuse or request removal</h2>
    <p>If you believe a listing infringes your rights, contains harmful software, or should not be here, email ${mail} with the link to the listing and the reason. The site owner can unpublish or delete any listing immediately, and will review reports as quickly as possible.</p>`],
  privacy: ["Privacy Policy", `
    <p>You can browse and download without an account.</p>
    <h2>What we collect</h2>
    <p><b>Downloads:</b> when you tap Download, we record the app, its version, the time, and whether you were signed in. We do not store your name, email or IP address in these records. The hosting and Supabase services we use (GitHub Pages, Google Supabase) may keep their own technical logs.</p>
    <p><b>Optional sign-in:</b> if you choose to log in with Google, Supabase Authentication handles the sign-in. If you save favorites, a list of app IDs is stored under your account. No other personal data is stored by this site.</p>
    <p><b>No ads or trackers</b> are added by this site.</p>
    <h2>Your choices</h2>
    <p>To have your saved favorites deleted, email ${mail}.</p>`],
  terms: ["Terms of Use", `
    <p>By using MG GAME HUB you agree to these terms.</p>
    <ul>
      <li>Apps are provided "as is", without warranty. You install them at your own risk.</li>
      <li>MG GAME HUB has not scanned apps for malware unless a listing explicitly says so. Install only what you trust.</li>
      <li>Android warns about apps installed from outside Google Play. That warning is normal for APK downloads.</li>
      <li>Only the site owner can publish apps, and the owner publishes only apps they own or have permission to distribute.</li>
      <li>Do not try to access, change or overload this site's systems, or re-host the files in a misleading way.</li>
      <li>Report problems or request removal at ${mail}.</li>
    </ul>`]
};
const [title, body] = PAGES[new URLSearchParams(location.search).get("p")] || PAGES.about;
document.title = title + " – MG GAME HUB";
document.getElementById("doc").innerHTML = `<h1>${esc(title)}</h1>${body}`;

return {  };
};
__defs["site-config.js"] = async function () {
const SITE = { name: "MG GAME HUB", brand: "MGCOWBELL / MGTECH" };
const CONTACT_EMAIL = "mgcowbell@gmail.com";   // shown on Contact page; used for abuse reports
const CATEGORIES = ["Action", "Adventure", "Arcade", "Puzzle", "Racing", "Sports", "Offline Games", "Tools", "Education", "Other"];
const TYPES = [["game", "Game"], ["app", "App"]];
const PAGE_SIZE = 24;
const MAX_APK_MB = 50;                        // Supabase free plan allows 50 MB per file; raise it (and the "apks" bucket limit) on a paid plan
const APK_MIME = "application/vnd.android.package-archive";
const VERIFY_WAIT_MS = 120000;                // how long the admin page waits for the server APK check

return { SITE, CONTACT_EMAIL, CATEGORIES, TYPES, PAGE_SIZE, MAX_APK_MB, APK_MIME, VERIFY_WAIT_MS };
};
__defs["admin.js"] = async function () {
const { sb, configured } = await __req("supabase-init.js");
const { SUPABASE_URL, SUPABASE_KEY, GOOGLE_LOGIN } = await __req("supabase-config.js");
const { renderChrome, esc, isAdmin, fmtSize, fmtDate, toast, signInGoogle, signOutUser, watchAuth, showConfigNotice, mediaUrl, bucketFor } = await __req("common.js");
const { CATEGORIES, TYPES, MAX_APK_MB, APK_MIME } = await __req("site-config.js");
const { fromRow } = await __req("data.js");
const { parseApk, guessName, androidFor } = await __req("apk-info.js");

renderChrome();
const $ = (id) => document.getElementById(id);
const MAX_SHOTS = 8;
let games = [], ed = null, busy = false, opened = false;
const urlCache = new Map();

// ---------- gate ----------
function gate(html) { $("gate").hidden = false; $("dash").hidden = true; $("gate").innerHTML = html; }
function onUser(u) {
  if (!u) {
    gate(`<div class="panel center"><h1>Admin sign-in</h1><p class="muted">Only the site owner can manage games.</p>
      ${GOOGLE_LOGIN ? `<button id="g-in" class="btn btn-primary btn-lg" type="button">Sign in with Google</button><p class="muted">or use your email</p>` : ""}
      <input id="g-mail" type="email" placeholder="mgcowbell@gmail.com" autocomplete="email" aria-label="Email">
      <input id="g-pass" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password">
      <button id="g-pw" class="btn btn-primary btn-lg" type="button">Log in</button>
      <p class="muted">First time or forgot your password? Get a login link by email, then tap “Set password” in the dashboard.</p>
      <button id="g-link" class="btn btn-ghost btn-lg" type="button">Email me a login link</button>
      <p id="g-msg" role="status" class="muted"></p></div>`);
    if ($("g-in")) $("g-in").onclick = async () => { try { await signInGoogle(); } catch (e) { toast("Sign-in failed: " + (e.message || e.code), "error"); } };
    $("g-pw").onclick = async () => {
      const email = $("g-mail").value.trim(), pass = $("g-pass").value, m = $("g-msg");
      if (!/^\S+@\S+\.\S+$/.test(email) || !pass) { m.textContent = "Enter your email and password."; return; }
      m.textContent = "Logging in…";
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      m.textContent = error ? "Login failed: " + error.message : "";
    };
    $("g-link").onclick = async () => {
      const email = $("g-mail").value.trim(), m = $("g-msg");
      if (!/^\S+@\S+\.\S+$/.test(email)) { m.textContent = "Enter your email address."; return; }
      m.textContent = "Sending…";
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      m.textContent = error ? "Couldn't send the link: " + error.message : "Check your email and open the link in this same browser.";
    };
  } else if (!isAdmin(u)) {
    gate(`<div class="panel center"><h1>Access denied</h1><p class="banner bad">Access denied. This account is not authorized to access the admin dashboard.</p>
      <button id="g-out" class="btn btn-ghost" type="button">Sign out</button></div>`);
    $("g-out").onclick = () => signOutUser();
  } else {
    $("gate").hidden = true; $("dash").hidden = false;
    loadGames().then(() => { if (!opened && new URLSearchParams(location.search).get("new") === "1") { opened = true; openEditor({}); } });
  }
}
$("out-btn").onclick = () => signOutUser();
if (!$("pw-btn")) $("out-btn").insertAdjacentHTML("beforebegin", '<button id="pw-btn" class="btn btn-ghost" type="button">Set password</button>');
$("pw-btn").onclick = async () => {
  const pw = prompt("Choose a new password (at least 8 characters):"); if (!pw) return;
  if (pw.length < 8) return toast("Use at least 8 characters.", "error");
  const { error } = await sb.auth.updateUser({ password: pw });
  toast(error ? error.message : "Password saved. Next time log in with your email and password.", error ? "error" : "ok");
};

// ---------- data ----------
async function loadGames() {
  $("rows").innerHTML = `<div class="loading"><span class="spinner"></span> Loading your games…</div>`;
  try {
    const { data, error } = await sb.from("games").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    games = (data || []).map(fromRow);
    renderStats(); renderList();
  } catch (e) {
    console.error(e);
    $("rows").innerHTML = `<div class="banner bad">Couldn't load games: ${esc(e.code || e.message)}. Make sure you're signed in as the admin.</div>`;
  }
}
function renderStats() {
  const pub = games.filter((g) => g.published).length;
  const dl = games.reduce((s, g) => s + (g.downloads || 0), 0);
  $("stats").innerHTML = `<div><span>Total apps</span><b>${games.length}</b></div><div><span>Published</span><b>${pub}</b></div><div><span>Drafts</span><b>${games.length - pub}</b></div><div><span>Downloads recorded</span><b>${dl.toLocaleString()}</b></div>`;
}
const previewUrl = async (path) => (path ? mediaUrl(path) : "");
function hydrateImages(root) {
  root.querySelectorAll("img[data-path]").forEach(async (img) => { const u = await previewUrl(img.dataset.path); if (u) img.src = u; });
}

// ---------- list ----------
$("acat").innerHTML = `<option value="all">All categories</option>` + CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("");
["aq", "astatus", "acat"].forEach((i) => $(i).addEventListener("input", renderList));
function renderList() {
  const q = $("aq").value.trim().toLowerCase(), st = $("astatus").value, c = $("acat").value;
  const list = games.filter((g) =>
    (st === "all" || (st === "published") === !!g.published) && (c === "all" || g.category === c) &&
    (!q || [g.name, g.category, g.shortDescription].some((v) => String(v || "").toLowerCase().includes(q))));
  $("rows").innerHTML = list.length ? list.map((g) => `
  <article class="row" data-id="${esc(g.id)}">
    <img class="thumb" data-path="${esc(g.iconPath || g.coverPath || "")}" alt="" width="56" height="56">
    <div class="row-main"><h3>${esc(g.name)}</h3>
      <p class="muted">${g.type === "app" ? "App" : "Game"} · v${esc(g.version)} · ${fmtSize(g.apkSize)} · ${esc(g.category)} · ⬇ ${(g.downloads || 0).toLocaleString()}</p>
      <p><span class="badge ${g.published ? "pub" : "draft"}">${g.published ? "Published" : "Draft"}</span>${g.featured ? ` <span class="badge feat">Featured</span>` : ""}</p></div>
    <div class="row-actions">
      <button class="btn btn-ghost" data-act="edit" type="button">Edit</button>
      <button class="btn btn-ghost" data-act="toggle" type="button">${g.published ? "Unpublish" : "Publish"}</button>
      <button class="btn btn-ghost" data-act="feature" type="button">${g.featured ? "Unfeature" : "Feature"}</button>
      <button class="btn btn-danger" data-act="delete" type="button">Delete</button>
    </div></article>`).join("")
    : `<div class="empty"><b>${games.length ? "No games match these filters." : "No games yet."}</b><p class="muted">${games.length ? "" : "Tap “New game” to upload your first APK."}</p></div>`;
  hydrateImages($("rows"));
}
$("rows").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const g = games.find((x) => x.id === b.closest(".row").dataset.id); if (!g) return;
  if (b.dataset.act === "edit") return openEditor(g);
  b.disabled = true;
  try {
    if (b.dataset.act === "toggle") {
      if (!g.published && (!g.apkPath || !g.iconPath || !g.rightsConfirmed)) throw new Error("Open Edit to add an APK and icon and confirm you have permission to distribute it, then publish.");
      const now = new Date().toISOString(), patch = { published: !g.published, updated_at: now };
      if (!g.published && !g.publishedAt) patch.published_at = now;
      { const { error } = await sb.from("games").update(patch).eq("id", g.id); if (error) throw error; } toast(g.published ? "Unpublished." : "Published.", "ok");
    } else if (b.dataset.act === "feature") {
      { const { error } = await sb.from("games").update({ featured: !g.featured, updated_at: new Date().toISOString() }).eq("id", g.id); if (error) throw error; } toast(g.featured ? "Removed from featured." : "Marked as featured.", "ok");
    } else if (b.dataset.act === "delete") {
      if (!confirm(`Delete “${g.name}” permanently? This removes its APK and images and cannot be undone.`)) { b.disabled = false; return; }
      const paths = [g.apkPath, g.iconPath, g.coverPath, g.bannerPath, ...(g.screenshotPaths || [])].filter(Boolean);
      const res = await Promise.allSettled(paths.map((p) => sb.storage.from(bucketFor(p)).remove([p])));
      { const { error } = await sb.from("games").delete().eq("id", g.id); if (error) throw error; }
      const failed = res.filter((r) => r.status === "rejected" || (r.value && r.value.error)).length;
      toast(failed ? `Game deleted, but ${failed} file(s) couldn't be removed from storage.` : "Game deleted.", failed ? "error" : "ok");
    }
    await loadGames();
  } catch (err) { toast(err.message || "Action failed.", "error"); b.disabled = false; }
});
$("new-btn").onclick = () => openEditor({});

// ---------- editor ----------
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game";
function openEditor(g) {
  ed = { g, apk: null, icon: null, cover: null, banner: null, shots: [], removed: new Set() };
  $("list-view").hidden = true; $("new-btn").hidden = true; $("stats").hidden = true;
  const isNew = !g.id, pub = !!g.published;
  $("editor").hidden = false;
  $("editor").innerHTML = `
  <form id="form" class="panel" novalidate>
    <div class="dash-head"><h2>${isNew ? "New game" : "Edit game"}</h2><button type="button" id="ed-back" class="btn btn-ghost">← Back</button></div>
    <fieldset><legend>${isNew ? "Step 1: choose your APK *" : "Game APK"}</legend>
      ${g.apkPath ? `<p class="muted">Current: ${esc(g.apkName || "APK")} · ${fmtSize(g.apkSize)}. Choose a file to replace it.</p>` : ""}
      <input id="f-apk" type="file" accept=".apk,${APK_MIME}">
      <p id="apk-info" class="muted">Only .apk files up to ${MAX_APK_MB} MB (free plan limit). The name, version, Android requirement, size and icon are filled in for you.</p>
    </fieldset>
    <label>Game name *<input id="f-name" maxlength="80" required value="${esc(g.name)}"></label>
    <label>Short description (shown on cards)<input id="f-short" maxlength="140" value="${esc(g.shortDescription)}"></label>
    <label>Detailed description<textarea id="f-desc" rows="6" maxlength="5000">${esc(g.description)}</textarea></label>
    <label>Type *<select id="f-type">${TYPES.map(([k, l]) => `<option value="${k}" ${(g.type || "game") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <div class="two">
      <label>Version *<input id="f-ver" maxlength="20" placeholder="1.0.0" value="${esc(g.version)}"></label>
      <label>Category *<select id="f-cat">${CATEGORIES.map((c) => `<option ${g.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
    </div>
    <label>Android minimum requirements<input id="f-min" maxlength="60" placeholder="Android 8.0 or higher" value="${esc(g.minAndroid)}"></label>
    <label>Installation instructions (optional)<textarea id="f-ins" rows="3" maxlength="1500">${esc(g.instructions)}</textarea></label>
    <label class="check"><input type="checkbox" id="f-feat" ${g.featured ? "checked" : ""}> Show in the Featured carousel</label>

    <fieldset><legend>Images</legend>
      <label>Icon (square) ${g.iconPath ? "– current shown" : "*"}<input id="f-icon" type="file" accept="image/*"></label>
      <img id="p-icon" class="prev" alt="" ${g.iconPath ? `data-path="${esc(g.iconPath)}"` : "hidden"}>
      <label>Promotional banner (wide, used in the Featured carousel)<input id="f-banner" type="file" accept="image/*"></label>
      <img id="p-banner" class="prev wide" alt="" ${g.bannerPath ? `data-path="${esc(g.bannerPath)}"` : "hidden"}>
      <label>Add screenshots (up to ${MAX_SHOTS})<input id="f-shots" type="file" accept="image/*" multiple></label>
      <div id="shot-list" class="shot-edit"></div>
    </fieldset>

    <label class="check"><input type="checkbox" id="f-rights" ${g.rightsConfirmed ? "checked" : ""}> I own this app or have permission to distribute it *</label>
    <div id="prog" hidden><div id="prog-label"></div><progress id="prog-bar" max="1" value="0"></progress><button type="button" id="skip-verify" class="btn btn-ghost btn-sm" hidden>Skip server check</button></div>
    <div id="form-msg" role="alert"></div>
    <div class="row-actions sticky">
      ${pub ? `<button type="button" class="btn btn-primary" data-save="keep">Save changes</button><button type="button" class="btn btn-ghost" data-save="draft">Unpublish &amp; save</button>`
            : `<button type="button" class="btn btn-ghost" data-save="draft">Save draft</button><button type="button" class="btn btn-primary" data-save="publish">Publish</button>`}
    </div>
  </form>`;
  hydrateImages($("editor"));
  renderShots();
  $("ed-back").onclick = closeEditor;
  $("f-apk").onchange = onApk;
  $("f-icon").onchange = (e) => onImg(e, "icon", "p-icon");
  $("f-banner").onchange = (e) => onImg(e, "banner", "p-banner");
  $("f-shots").onchange = onShots;
  $("shot-list").onclick = (e) => {
    const b = e.target.closest("[data-rm]"); if (!b) return;
    if (b.dataset.rm === "old") ed.removed.add(b.dataset.path); else ed.shots.splice(+b.dataset.i, 1);
    renderShots();
  };
  $("form").querySelectorAll("[data-save]").forEach((b) => (b.onclick = () => save(b.dataset.save)));
  window.scrollTo(0, 0);
}
function closeEditor() {
  if (busy) return;
  ed = null; $("editor").hidden = true; $("editor").innerHTML = "";
  $("list-view").hidden = false; $("new-btn").hidden = false; $("stats").hidden = false;
}
function renderShots() {
  const old = (ed.g.screenshotPaths || []).filter((p) => !ed.removed.has(p));
  $("shot-list").innerHTML =
    old.map((p) => `<div class="shot"><img data-path="${esc(p)}" alt=""><button type="button" class="btn btn-danger" data-rm="old" data-path="${esc(p)}">Remove</button></div>`).join("") +
    ed.shots.map((f, i) => `<div class="shot"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="btn btn-danger" data-rm="new" data-i="${i}">Remove</button></div>`).join("");
  hydrateImages($("shot-list"));
}
async function onApk(e) {
  const f = e.target.files[0]; ed.apk = null; $("apk-info").className = "muted";
  if (!f) return;
  try { await checkApk(f); ed.apk = f; }
  catch (err) { e.target.value = ""; $("apk-info").className = "bad-text"; $("apk-info").textContent = err.message; return; }
  $("apk-info").textContent = `${f.name} · ${fmtSize(f.size)}. Reading details…`;
  const set = (id, val, force) => { const el = $(id); if (val && (force || !el.value.trim())) { el.value = val; return true; } return false; };
  const filled = [];
  try {
    const a = await parseApk(f); ed.apkInfo = a;
    if (set("f-name", a.label || guessName(f.name, a.packageName), false)) filled.push("name");
    if (set("f-ver", a.versionName || (a.versionCode ? String(a.versionCode) : ""), true)) filled.push("version");
    if (set("f-min", a.minSdk ? androidFor(a.minSdk) : "", true)) filled.push("Android requirement");
    if (a.iconBlob && !ed.g.iconPath && !ed.icon) {
      ed.icon = new File([a.iconBlob], "icon.png", { type: "image/png" });
      const p = $("p-icon"); p.removeAttribute("data-path"); p.src = URL.createObjectURL(ed.icon); p.hidden = false; filled.push("icon");
    }
  } catch (err) {
    console.warn("APK details unreadable:", err);
    if (set("f-name", guessName(f.name), false)) filled.push("name");
  }
  $("apk-info").textContent = `${f.name} · ${fmtSize(f.size)}` + (filled.length ? `. Filled in: ${filled.join(", ")}. Check them, then add a description.` : ". Couldn't read details from this APK, please fill them in.");
}
async function checkApk(f) {
  if (!/\.apk$/i.test(f.name)) throw new Error("Only Android .apk files are allowed.");
  if (f.type && ![APK_MIME, "application/octet-stream", "application/x-apk", "application/vnd.android.package"].includes(f.type)) throw new Error(`Unexpected file type “${f.type}”. Choose an .apk file.`);
  if (f.size <= 0) throw new Error("That file is empty.");
  if (f.size > MAX_APK_MB * 1048576) throw new Error(`That APK is ${fmtSize(f.size)}. The limit is ${MAX_APK_MB} MB.`);
  const h = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  if (h[0] !== 0x50 || h[1] !== 0x4b) throw new Error("This doesn't look like a valid APK (it isn't a ZIP package).");
}
function onImg(e, key, prevId) {
  const f = e.target.files[0]; ed[key] = f || null;
  const p = $(prevId);
  if (f) { p.removeAttribute("data-path"); p.src = URL.createObjectURL(f); p.hidden = false; }
}
function onShots(e) {
  const keep = (ed.g.screenshotPaths || []).filter((p) => !ed.removed.has(p)).length;
  for (const f of e.target.files) { if (keep + ed.shots.length < MAX_SHOTS && f.type.startsWith("image/")) ed.shots.push(f); }
  e.target.value = ""; renderShots();
}
async function shrink(file, max) {
  if (!file.type.startsWith("image/")) throw new Error(`“${file.name}” isn't an image.`);
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.85));
  if (!blob) throw new Error("Couldn't process that image.");
  return blob;
}
function progress(label, frac) { $("prog").hidden = false; $("prog-label").textContent = label; $("prog-bar").value = frac; }
const newId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
// Upload with a progress bar straight to Supabase Storage (admin token required; storage policies enforce it).
function upload(path, blob, meta, label) {
  return new Promise(async (resolve, reject) => {
    try {
      const { data } = await sb.auth.getSession(); const tok = data.session && data.session.access_token;
      if (!tok) throw Object.assign(new Error("You are signed out. Sign in again."), { code: "unauthorized" });
      const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", blob.slice(0, blob.size, meta.contentType || blob.type));
      const x = new XMLHttpRequest();
      x.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucketFor(path)}/${path.split("/").map(encodeURIComponent).join("/")}`);
      x.setRequestHeader("Authorization", "Bearer " + tok); x.setRequestHeader("apikey", SUPABASE_KEY); x.setRequestHeader("x-upsert", "false");
      x.upload.onprogress = (e) => { if (e.lengthComputable) progress(`${label} – ${Math.round((e.loaded / e.total) * 100)}% (${fmtSize(e.loaded)} of ${fmtSize(e.total)})`, e.loaded / e.total); };
      x.onload = () => {
        if (x.status < 300) return resolve(path);
        let m = ""; try { m = JSON.parse(x.responseText).message || ""; } catch (e) { /* ignore */ }
        reject(Object.assign(new Error(m || "Upload failed (" + x.status + ")"), { code: x.status === 413 ? "too-big" : x.status === 401 || x.status === 403 ? "unauthorized" : "upload" }));
      };
      x.onerror = () => reject(Object.assign(new Error("network"), { code: "network" }));
      x.send(fd);
    } catch (e) { reject(e); }
  });
}
function friendly(e) {
  const c = e.code || "", m = e.message || "";
  if (c === "unauthorized" || c === "42501" || /row-level security|not allowed/i.test(m)) return "Supabase refused this. Make sure you're signed in as mgcowbell@gmail.com.";
  if (c === "too-big") return "That file is too big for your Supabase plan (the free plan allows 50 MB per file).";
  if (c === "network") return "The connection was too slow or was lost. Check your internet and press the button again.";
  if (c === "23514") return "Publishing needs an APK, an icon and the ownership confirmation.";
  return m || "Something went wrong. Please try again.";
}
const removeFiles = (paths) => Promise.allSettled(paths.map((p) => sb.storage.from(bucketFor(p)).remove([p])));

async function save(mode) {
  if (busy) return;
  const g = ed.g, msg = $("form-msg"); msg.className = ""; msg.textContent = "";
  const v = (id) => $(id).value.trim();
  const name = v("f-name"), version = v("f-ver"), category = v("f-cat");
  const hasApk = !!(ed.apk || g.apkPath), hasIcon = !!(ed.icon || g.iconPath);
  const publish = mode === "publish" ? true : mode === "draft" ? false : !!g.published;
  const fail = (t) => { msg.className = "banner bad"; msg.textContent = t; msg.scrollIntoView({ block: "center" }); };
  if (!name) return fail("Enter the game name.");
  if (!version) return fail("Enter the game version.");
  if (!CATEGORIES.includes(category)) return fail("Choose a category.");
  if (publish && !hasApk) return fail("Upload an APK before publishing.");
  if (publish && !hasIcon) return fail("Add an icon before publishing.");
  if (publish && !$("f-rights").checked) return fail("Confirm that you own this app or have permission to distribute it.");

  busy = true; document.querySelectorAll("[data-save],#ed-back").forEach((b) => (b.disabled = true));
  const fresh = [], stale = [];
  try {
    const gid = g.id || newId(), now = new Date().toISOString();
    const row = {
      name, short_description: v("f-short"), description: v("f-desc"), version, category,
      min_android: v("f-min"), instructions: v("f-ins"), featured: $("f-feat").checked, type: v("f-type"),
      rights_confirmed: $("f-rights").checked, apk_path: g.apkPath || "", apk_size: g.apkSize || 0,
      icon_path: g.iconPath || "", banner_path: g.bannerPath || "", min_sdk: g.minSdk || null, package_name: g.packageName || ""
    };
    if (ed.apk) {
      await checkApk(ed.apk);
      const p = `games/${gid}/apk/${Date.now()}.apk`;
      await upload(p, ed.apk, { contentType: APK_MIME }, "Uploading APK");
      fresh.push(p); if (g.apkPath) stale.push(g.apkPath);
      Object.assign(row, { apk_path: p, apk_size: ed.apk.size, min_sdk: (ed.apkInfo && ed.apkInfo.minSdk) || null, package_name: (ed.apkInfo && ed.apkInfo.packageName) || "" });
    }
    for (const [key, col, old, max] of [["icon", "icon_path", g.iconPath, 512], ["banner", "banner_path", g.bannerPath, 1600]]) {
      if (!ed[key]) continue;
      const blob = await shrink(ed[key], max);
      const p = `games/${gid}/${key}/${Date.now()}.webp`;
      await upload(p, blob, { contentType: blob.type }, `Uploading ${key}`);
      fresh.push(p); if (old) stale.push(old); row[col] = p;
    }
    const shots = (g.screenshotPaths || []).filter((p) => !ed.removed.has(p));
    ed.removed.forEach((p) => stale.push(p));
    for (let i = 0; i < ed.shots.length; i++) {
      const blob = await shrink(ed.shots[i], 1280);
      const p = `games/${gid}/shots/${Date.now()}-${i}.webp`;
      await upload(p, blob, { contentType: blob.type }, `Uploading screenshot ${i + 1} of ${ed.shots.length}`);
      fresh.push(p); shots.push(p);
    }
    row.screenshot_paths = shots; row.published = publish; row.updated_at = now;
    if (publish && !g.publishedAt) row.published_at = now;
    progress("Saving game details…", 1);
    const r = g.id ? await sb.from("games").update(row).eq("id", gid) : await sb.from("games").insert({ ...row, id: gid });
    if (r.error) throw r.error;
    await removeFiles(stale); // remove replaced files
    toast(publish ? (g.published ? "Saved." : "Published! Visitors can now download it.") : "Saved as draft.", "ok");
    busy = false; closeEditor(); await loadGames();
  } catch (e) {
    console.error(e);
    await removeFiles(fresh); // don't leave orphan uploads
    fail(friendly(e)); toast("Upload failed. Nothing was published.", "error");
    $("prog").hidden = true;
    busy = false; document.querySelectorAll("[data-save],#ed-back").forEach((b) => (b.disabled = false));
  }
}

if (!configured) { showConfigNotice($("notice")); $("gate").innerHTML = ""; } else watchAuth(onUser);

return {  };
};
__defs["data.js"] = async function () {
// Reads for the public catalog (Supabase).
const { sb } = await __req("supabase-init.js");
const { PAGE_SIZE, CATEGORIES } = await __req("site-config.js");

const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
const ts = (s) => (s ? { toMillis: () => Date.parse(s), toDate: () => new Date(s) } : null);
// Database row -> the shape the pages use.
const fromRow = (r) => ({
  id: r.id, name: r.name, shortDescription: r.short_description, description: r.description, instructions: r.instructions,
  category: r.category, type: r.type, version: r.version, minAndroid: r.min_android, minSdk: r.min_sdk || 0, packageName: r.package_name,
  apkPath: r.apk_path, apkName: String(r.apk_path || "").split("/").pop(), apkSize: Number(r.apk_size) || 0,
  iconPath: r.icon_path, bannerPath: r.banner_path, coverPath: "", screenshotPaths: r.screenshot_paths || [],
  published: r.published, featured: r.featured, rightsConfirmed: r.rights_confirmed, downloads: Number(r.downloads) || 0,
  apkVerified: false, publishedAt: ts(r.published_at), updatedAt: ts(r.updated_at)
});
const usingFallback = () => false;

async function fetchPage({ type = "", category = "", sort = "newest", size = PAGE_SIZE, cursor = null } = {}) {
  const off = (cursor && cursor.offset) || 0;
  let q = sb.from("games").select("*").eq("published", true);
  if (type) q = q.eq("type", type);
  if (category) q = q.eq("category", category);
  if (sort === "top") q = q.gt("downloads", 0).order("downloads", { ascending: false }).order("published_at", { ascending: false });
  else q = q.order("published_at", { ascending: false });
  const { data, error } = await q.range(off, off + size - 1);
  if (error) throw error;
  const items = (data || []).map(fromRow);
  return { items, cursor: { offset: off + size }, done: items.length < size };
}

async function fetchFeatured() {
  const { data, error } = await sb.from("games").select("*").eq("published", true).eq("featured", true).order("published_at", { ascending: false }).limit(10);
  if (error) throw error;
  return (data || []).map(fromRow);
}

async function countByCategory() {
  const { data, error } = await sb.from("games").select("category").eq("published", true).limit(1000);
  if (error) throw error;
  const o = {}; (data || []).forEach((g) => (o[g.category] = (o[g.category] || 0) + 1));
  return o;
}

const tokenize = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
async function searchGames(term) {
  const words = tokenize(term).map((w) => w.slice(0, 30));
  if (!words.length) return [];
  let q = sb.from("games").select("*").eq("published", true);
  for (const w of words) q = q.or(`name.ilike.%${w}%,short_description.ilike.%${w}%,category.ilike.%${w}%`);
  const { data, error } = await q.limit(150);
  if (error) throw error;
  const items = (data || []).map(fromRow), s = words.join(" ");
  return items.sort((a, b) => (String(b.name).toLowerCase().startsWith(s) - String(a.name).toLowerCase().startsWith(s)) || ms(b.publishedAt) - ms(a.publishedAt));
}

return { fromRow, usingFallback, fetchPage, fetchFeatured, countByCategory, tokenize, searchGames };
};
__defs["supabase-init.js"] = async function () {
const { SUPABASE_URL, SUPABASE_KEY } = await __req("supabase-config.js");
let client = null, why = "";
if (!SUPABASE_URL || !SUPABASE_KEY || String(SUPABASE_URL).startsWith("PASTE")) why = "config";
else if (!window.supabase) why = "library";
else {
  try { client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); }
  catch (e) { why = "init"; console.error(e); }
}
const configured = !!client;
const sb = client;
const notConfiguredReason = why;

return { configured, sb, notConfiguredReason };
};
__defs["apk-info.js"] = async function () {
// Reads details out of an APK in the browser (an APK is a ZIP file).
// Only the parts needed are read, so a large APK is never loaded fully into memory.
const u16 = (d, o) => d.getUint16(o, true);
const u32 = (d, o) => d.getUint32(o, true);
const API = { 14: "4.0", 15: "4.0.3", 16: "4.1", 17: "4.2", 18: "4.3", 19: "4.4", 20: "4.4W", 21: "5.0", 22: "5.1", 23: "6.0", 24: "7.0", 25: "7.1", 26: "8.0", 27: "8.1", 28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16" };
const androidFor = (sdk) => (API[sdk] ? `Android ${API[sdk]} or higher` : `Android (API ${sdk}) or higher`);

async function readEntries(file) {
  const tail = Math.min(file.size, 65557);
  const buf = new Uint8Array(await file.slice(file.size - tail).arrayBuffer());
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 5 && buf[i + 3] === 6) { eocd = i; break; }
  if (eocd < 0) throw new Error("Not a ZIP file");
  const e = new DataView(buf.buffer);
  const count = u16(e, eocd + 10), cdSize = u32(e, eocd + 12), cdOff = u32(e, eocd + 16);
  const cd = new Uint8Array(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dv = new DataView(cd.buffer), td = new TextDecoder(), entries = new Map();
  let p = 0;
  for (let i = 0; i < count && p + 46 <= cd.length; i++) {
    if (u32(dv, p) !== 0x02014b50) break;
    const nlen = u16(dv, p + 28), elen = u16(dv, p + 30), clen = u16(dv, p + 32);
    entries.set(td.decode(cd.subarray(p + 46, p + 46 + nlen)), { method: u16(dv, p + 10), csize: u32(dv, p + 20), usize: u32(dv, p + 24), lho: u32(dv, p + 42) });
    p += 46 + nlen + elen + clen;
  }
  return entries;
}
async function readEntry(file, e) {
  const lh = new DataView(await file.slice(e.lho, e.lho + 30).arrayBuffer());
  const start = e.lho + 30 + u16(lh, 26) + u16(lh, 28);
  const raw = new Uint8Array(await file.slice(start, start + e.csize).arrayBuffer());
  if (e.method === 0) return raw;
  if (e.method !== 8) throw new Error("Unsupported compression");
  const out = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function readStringPool(dv, off, hsize) {
  const count = u32(dv, off + 8), utf8 = (u32(dv, off + 16) & 0x100) !== 0, start = u32(dv, off + 20), out = [];
  for (let i = 0; i < count; i++) {
    let p = off + start + u32(dv, off + hsize + i * 4);
    if (utf8) {
      let l = dv.getUint8(p++); if (l & 0x80) l = ((l & 0x7f) << 8) | dv.getUint8(p++);
      let b = dv.getUint8(p++); if (b & 0x80) b = ((b & 0x7f) << 8) | dv.getUint8(p++);
      out.push(new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset + p, b)));
    } else {
      let l = u16(dv, p); p += 2; if (l & 0x8000) { l = ((l & 0x7fff) << 16) | u16(dv, p); p += 2; }
      let s = ""; for (let k = 0; k < l; k++) s += String.fromCharCode(u16(dv, p + k * 2));
      out.push(s);
    }
  }
  return out;
}

// Parses Android's binary AndroidManifest.xml.
function parseManifest(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u16(dv, 0) !== 0x0003) throw new Error("Not a binary manifest");
  const total = Math.min(u32(dv, 4), bytes.length);
  let off = 8, strings = [];
  const r = {};
  while (off + 8 <= total) {
    const type = u16(dv, off), hsize = u16(dv, off + 2), size = u32(dv, off + 4);
    if (size < 8) break;
    if (type === 0x0001) strings = readStringPool(dv, off, hsize);
    else if (type === 0x0102) {
      const el = strings[u32(dv, off + 20)];
      const aStart = off + 16 + u16(dv, off + 24), aSize = u16(dv, off + 26), aCount = u16(dv, off + 28);
      for (let i = 0; i < aCount; i++) {
        const a = aStart + i * aSize, name = strings[u32(dv, a + 4)];
        const raw = u32(dv, a + 8), t = dv.getUint8(a + 15), data = u32(dv, a + 16);
        const v = t === 3 ? strings[raw !== 0xffffffff ? raw : data] : t === 0x10 ? data | 0 : t === 0x11 ? data : t === 0x01 ? { ref: data } : undefined;
        if (el === "manifest" && name === "package") r.packageName = v;
        else if (el === "manifest" && name === "versionName") r.versionName = v;
        else if (el === "manifest" && name === "versionCode") r.versionCode = v;
        else if (el === "uses-sdk" && name === "minSdkVersion" && typeof v === "number") r.minSdk = v;
        else if (el === "application" && name === "label" && typeof v === "string") r.label = v;
      }
    }
    off += size;
  }
  return r;
}

const DENS = { xxxhdpi: 6, xxhdpi: 5, xhdpi: 4, hdpi: 3, mdpi: 2, ldpi: 1 };
function pickIcon(entries) {
  let best = null, top = -1;
  for (const [n, e] of entries) {
    const m = /^res\/(?:mipmap|drawable)[^/]*\/(ic_launcher|app_icon|icon|ic_launcher_round|ic_launcher_foreground)\.png$/i.exec(n);
    if (!m || e.usize > 4 * 1048576) continue;
    const d = (/-(xxxhdpi|xxhdpi|xhdpi|hdpi|mdpi|ldpi)/.exec(n) || [])[1];
    const kind = m[1].toLowerCase();
    const s = (DENS[d] || 2) * 10 + (kind === "ic_launcher" ? 3 : kind === "app_icon" || kind === "icon" ? 2 : kind === "ic_launcher_round" ? 1 : 0);
    if (s > top) { top = s; best = e; }
  }
  return best;
}

function guessName(fileName, pkg) {
  const words = fileName.replace(/\.apk$/i, "").split(/[-_.\s]+/).filter(Boolean);
  const skip = /^(v?\d+|release|debug|signed|final|apk|app|universal|arm64|armeabi)$/i;
  let w = words.filter((x) => !skip.test(x));
  if (!w.length && pkg) w = String(pkg).split(".").slice(-1);
  if (!w.length) w = words.filter((x) => !/^(apk|release|debug)$/i.test(x));
  return w.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" ");
}

// Returns { packageName, versionName, versionCode, minSdk, label, iconBlob } (any may be missing).
async function parseApk(file) {
  const entries = await readEntries(file);
  const out = {};
  const m = entries.get("AndroidManifest.xml");
  if (m) Object.assign(out, parseManifest(await readEntry(file, m)));
  const ic = pickIcon(entries);
  if (ic) { try { out.iconBlob = new Blob([await readEntry(file, ic)], { type: "image/png" }); } catch { /* optional */ } }
  return out;
}

return { androidFor, parseManifest, guessName, parseApk };
};
__defs["supabase-config.js"] = async function () {
const __u = window.MG_SUPABASE_URL, __k = window.MG_SUPABASE_KEY, __a = window.MG_ADMIN_EMAIL;
const SUPABASE_URL = (__u && !/^PASTE/.test(__u)) ? __u : "https://hghhfotaxbjziszzbkcc.supabase.co";
const SUPABASE_KEY = (__k && !/^PASTE/.test(__k)) ? __k : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnaGhmb3RheGJqemlzenpia2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNjcyNzEsImV4cCI6MjEwNzg0MzI3MX0.zybusnaf68BHvKBrSvgHvx710M_-5nvmgzxRRO1dwF4";
const ADMIN_EMAIL = String(__a || "mgcowbell@gmail.com").toLowerCase();
const GOOGLE_LOGIN = window.MG_GOOGLE_LOGIN === true;

return { SUPABASE_URL, SUPABASE_KEY, ADMIN_EMAIL, GOOGLE_LOGIN };
};

var entry = document.currentScript && document.currentScript.getAttribute("data-entry");
if (entry) __req(entry).catch(function (e) { banner((e && e.message) || e); console.error(e); });
})();
