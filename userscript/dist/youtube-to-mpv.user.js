// ==UserScript==
// @name         Stream to MPV
// @namespace    https://github.com/jcchikikomori/stream-to-mpv
// @version      0.6.0
// @description  Open YouTube and Twitch videos directly in MPV media player via system protocol handlers
// @author       John Cyrill Corsanes
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://www.twitch.tv/*
// @match        https://twitch.tv/*
// @match        https://m.twitch.tv/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/jcchikikomori/stream-to-mpv/main/userscript/dist/youtube-to-mpv.user.js
// @installURL   https://raw.githubusercontent.com/jcchikikomori/stream-to-mpv/main/userscript/dist/youtube-to-mpv.user.js
// ==/UserScript==


"use strict";(()=>{var Ue=Object.defineProperty;var Se=(e,t,n)=>t in e?Ue(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var a=(e,t,n)=>Se(e,typeof t!="symbol"?t+"":t,n);var m=class extends Error{constructor(t,n){super(t,n),this.name=new.target.name}},b=class extends m{},T=class extends b{},M=class extends m{constructor(n,r,o){super(n);a(this,"statusCode");a(this,"body");this.statusCode=r,this.body=o}},y=class extends m{};var Oe=/[\t\n]/,_e=["domain","name","value","path","secure","httpOnly","expirationDate"];function Le(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function k(e,t,n){if(e===void 0){if(n)throw new RangeError(`cookie ${t} is required`);return}if(typeof e!="string")throw new RangeError(`cookie ${t} must be a string`);if(e.length>4096)throw new RangeError(`cookie ${t} exceeds 4096 characters`);if(Oe.test(e))throw new RangeError(`cookie ${t} contains a forbidden control character`);if(n&&e.length===0)throw new RangeError(`cookie ${t} must not be empty`);return e}function Ve(e){if(!Le(e))throw new RangeError("cookie entry must be an object");let t=Object.keys(e).find(s=>!_e.includes(s));if(t)throw new RangeError(`unexpected cookie field "${t}"`);let n=k(e.domain,"domain",!0),r=k(e.name,"name",!0),o=k(e.value,"value",!1)??"",i=k(e.path,"path",!1);if(e.secure!==void 0&&typeof e.secure!="boolean")throw new RangeError("cookie secure must be a boolean");if(e.httpOnly!==void 0&&typeof e.httpOnly!="boolean")throw new RangeError("cookie httpOnly must be a boolean");if(e.expirationDate!==void 0&&e.expirationDate!==null&&!(typeof e.expirationDate=="number"&&Number.isFinite(e.expirationDate)))throw new RangeError("cookie expirationDate must be a finite number or null");return{domain:n,name:r,value:o,...i!==void 0?{path:i}:{},...e.secure!==void 0?{secure:e.secure}:{},...e.httpOnly!==void 0?{httpOnly:e.httpOnly}:{},...e.expirationDate!==void 0?{expirationDate:e.expirationDate}:{}}}function q(e){if(e==null)return null;if(!Array.isArray(e))throw new RangeError("cookies must be an array");if(e.length===0)return null;if(e.length>200)throw new RangeError("cookies exceeds the maximum of 200 entries");return e.map(Ve)}var W=new Set(["127.0.0.1","localhost","[::1]"]);function H(e){let t=new URL(e);if(t.protocol!=="http:")throw new RangeError(`mpv-handler base URL must use http:, got "${t.protocol}"`);if(t.username||t.password)throw new RangeError("mpv-handler base URL must not contain credentials");if(!W.has(t.hostname)){let n=[...W].join(", ");throw new RangeError(`mpv-handler base URL host must be loopback (one of ${n}), got "${t.hostname}"`)}}function z(e){try{return H(e),!0}catch{return!1}}function X(e){return typeof e=="object"&&e!==null&&!Array.isArray(e)}function J(e,t){return Object.keys(e).find(n=>!t.includes(n))}var Z={safeParse(e){if(!X(e))return{success:!1,error:{message:"expected an object"}};let t=J(e,["status","message"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="ok"&&e.status!=="error"?{success:!1,error:{message:'status must be "ok" or "error"'}}:e.message!==void 0&&typeof e.message!="string"?{success:!1,error:{message:"message must be a string"}}:{success:!0,data:e.message!==void 0?{status:e.status,message:e.message}:{status:e.status}}}},Q={safeParse(e){if(!X(e))return{success:!1,error:{message:"expected an object"}};let t=J(e,["status"]);return t?{success:!1,error:{message:`unexpected key "${t}"`}}:e.status!=="running"?{success:!1,error:{message:'status must be "running"'}}:{success:!0,data:{status:"running"}}}};var $e="http://127.0.0.1:38421",De=5e3;function He(e){return typeof e=="object"&&e!==null&&"message"in e&&typeof e.message=="string"}var I=class{constructor(t={}){a(this,"baseUrl");a(this,"timeoutMs");a(this,"fetchImpl");this.baseUrl=t.baseUrl??$e,this.timeoutMs=t.timeoutMs??De,this.fetchImpl=t.fetchImpl??fetch,t.allowNonLoopback?console.warn(`[Stream to MPV] MpvHandlerClient constructed with allowNonLoopback=true for baseUrl "${this.baseUrl}" \u2014 the loopback SSRF guard is disabled for this instance.`):H(this.baseUrl)}async play(t,n={}){let r=n.timestampSeconds??null;if(r!==null&&!(Number.isFinite(r)&&r>=0))throw new RangeError(`timestampSeconds must be a finite number >= 0, got ${String(r)}`);let o=q(n.cookies);return this.requestJson("/play",{url:t,t:r!==null?String(r):void 0,cookies:o??void 0},Z)}async health(){return this.request("/health",{},Q)}buildRequestUrl(t,n){let r=Object.entries(n).filter(i=>i[1]!==void 0).map(([i,s])=>`${i}=${encodeURIComponent(s)}`),o=r.length>0?`?${r.join("&")}`:"";return`${this.baseUrl}${t}${o}`}async request(t,n,r){let o=await this.fetch(this.buildRequestUrl(t,n),t,{signal:AbortSignal.timeout(this.timeoutMs)});return this.parseResponse(o,r)}async requestJson(t,n,r){let o=await this.fetch(`${this.baseUrl}${t}`,t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n),signal:AbortSignal.timeout(this.timeoutMs)});return this.parseResponse(o,r)}async fetch(t,n,r){try{return await this.fetchImpl(t,r)}catch(o){throw o instanceof Error&&o.name==="TimeoutError"?new T(`mpv-handler did not respond within ${this.timeoutMs}ms (${this.baseUrl}${n})`,{cause:o}):new b(`mpv-handler unreachable at ${this.baseUrl}`,{cause:o})}}async parseResponse(t,n){let r=await t.text(),o;try{o=r.length>0?JSON.parse(r):void 0}catch(s){throw new y("mpv-handler returned a non-JSON response",{cause:s})}if(!t.ok){let s=He(o)?o.message:`HTTP ${t.status}`;throw new M(`mpv-handler rejected the request: ${s}`,t.status,o)}let i=n.safeParse(o);if(!i.success)throw new y(`mpv-handler response failed validation: ${i.error.message}`);return i.data}};var f=class extends Error{};var h=class{constructor(t){a(this,"client");this.client=t}async open(t,n={}){let r=this.resolveUrl(t);if(!r)throw new f(`${this.platform}: not a valid URL or ID: ${t}`);let o=n.timestampSeconds??null,i=n.cookies??null;return await this.client.play(r,{timestampSeconds:o,cookies:i}),{resolvedUrl:r,timestampSeconds:o}}};var Ae=new Set(["www.twitch.tv","twitch.tv","m.twitch.tv"]),Ne=/^[a-zA-Z0-9_]{4,25}$/,je=/^\/videos\/(\d+)$/,Be=new Set(["videos","directory","settings","subscriptions","p","jobs","turbo","login","signup","moderator","friends","inventory","wallet","drops","payments","following","search"]);function A(e){return Ne.test(e)&&!Be.has(e.toLowerCase())}function ee(e){return/^\d+$/.test(e)}function te(e){if(e.protocol!=="https:"||e.username||e.password||!Ae.has(e.hostname))return null;let t=je.exec(e.pathname);if(t){let r=t[1];return r&&ee(r)?{kind:"vod",value:r}:null}let n=/^\/([^/]+)$/.exec(e.pathname);if(n){let r=n[1];if(r&&A(r))return{kind:"channel",value:r}}return null}function v(e){let t=e.trim();if(A(t))return t;try{let n=te(new URL(t));return n?.kind==="channel"?n.value:null}catch{return null}}function x(e){try{let t=te(new URL(e.trim()));return t?.kind==="vod"?t.value:null}catch{return null}}function R(e){return A(e)?`https://www.twitch.tv/${e}`:null}function P(e){return ee(e)?`https://www.twitch.tv/videos/${e}`:null}var Fe=/^\d+$/,Ge=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function ne(e){if(!e)return null;if(Fe.test(e))return parseInt(e,10);let t=Ge.exec(e);if(!t||!(t[1]||t[2]||t[3]))return null;let n=parseInt(t[1]??"0",10),r=parseInt(t[2]??"0",10),o=parseInt(t[3]??"0",10);return n*3600+r*60+o}var U=class extends h{constructor(){super(...arguments);a(this,"platform","twitch")}supports(n){return x(n)!==null||v(n)!==null}resolveUrl(n){let r=x(n);if(r)return P(r);let o=v(n);return o?R(o):null}parseTimestamp(n){return ne(n)}};var Ke=/^[a-zA-Z0-9_-]{11}$/,Ye=new Set(["www.youtube.com","youtube.com","m.youtube.com"]),qe="youtu.be",We=/^\/shorts\/([^/]+)$/;function u(e){return Ke.test(e)}function ze(e){if(e.protocol!=="https:"||e.username||e.password)return null;if(Ye.has(e.hostname)){if(e.pathname==="/watch"){let n=e.searchParams.get("v");return n&&u(n)?n:null}let t=We.exec(e.pathname);if(t){let n=t[1];if(n&&u(n))return n}return null}if(e.hostname===qe){let t=e.pathname.slice(1);if(u(t))return t}return null}function N(e){let t=e.trim();if(u(t))return t;try{return ze(new URL(t))}catch{return null}}function S(e){return u(e)?`https://www.youtube.com/watch?v=${e}`:null}var Xe=/^\d+$/,Je=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function O(e){if(!e)return null;if(Xe.test(e))return parseInt(e,10);let t=Je.exec(e);if(!t||!(t[1]||t[2]||t[3]))return null;let n=parseInt(t[1]??"0",10),r=parseInt(t[2]??"0",10),o=parseInt(t[3]??"0",10);return n*3600+r*60+o}var _=class extends h{constructor(){super(...arguments);a(this,"platform","youtube")}supports(n){return N(n)!==null}resolveUrl(n){let r=N(n);return r?S(r):null}parseTimestamp(n){return O(n)}};function re(e,t,n={}){let r=n.mpvPath??"mpv",o=n.platform==="windows",i=t!==null?` --start=${t}`:"";return o?`"${r}" "${e}"${i}`:`'${r}' '${e}'${i}`}async function oe(e){try{return await navigator.clipboard.writeText(e),{copied:!0}}catch{return{copied:!1}}}var Ze={mpvPath:"mpv",showButton:!0,autoPlaylist:!1,enableNativeMenuItems:!0};function l(e){return GM_getValue(e,Ze[e])}function C(e,t){GM_setValue(e,t)}var ie=`
  <path d="M8 5v14l11-7z"/>
  <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
`,L=`<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${ie}</svg>`,j=`<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${ie}</svg>`;var se="mpv-toast";function c(e,t,n){document.getElementById(se)?.remove();let r=window.matchMedia("(prefers-color-scheme: dark)").matches,o=t==="error",i=o?"#e74c3c":r?"#333":"#fff",s=o||r?"#fff":"#333",E=o?"transparent":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",Ie=o?"rgba(255,255,255,0.2)":r?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.05)",Re=o?"rgba(255,255,255,0.3)":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",Pe=o||r?"#fff":"#333",d=document.createElement("div");d.id=se,d.style.cssText=`
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${i};
    color: ${s};
    border: 1px solid ${E};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: mpv-fade-in 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;let Y=document.createElement("span");if(Y.textContent=e,d.appendChild(Y),n!==void 0){let p=document.createElement("button");p.textContent="Copy",p.style.cssText=`
      background: ${Ie};
      border: 1px solid ${Re};
      color: ${Pe};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `,p.onclick=()=>{navigator.clipboard.writeText(n).then(()=>{p.textContent="Copied!",setTimeout(()=>{p.textContent="Copy"},1e3)}).catch(()=>{})},d.appendChild(p)}document.body.appendChild(d),setTimeout(()=>{d.style.animation="mpv-fade-out 0.3s ease",setTimeout(()=>d.remove(),300)},5e3)}var Qe=["youtube.com","google.com"];function et(e){return{domain:e.domain,name:e.name,value:e.value,path:e.path,secure:e.secure,httpOnly:e.httpOnly,expirationDate:e.session?null:e.expirationDate??null}}function tt(e){return new Promise(t=>{try{GM_cookie.list({domain:e},(n,r)=>{t(r||!n?[]:n)})}catch{t([])}})}async function ae(){if(typeof GM_cookie>"u")return null;let t=(await Promise.all(Qe.map(tt))).flat();return t.length===0?null:t.map(et)}function nt(){let e=/[?&]v=([^&]+)/.exec(window.location.search);if(e?.[1]&&u(e[1]))return e[1];let t=window.ytInitialPlayerResponse?.videoDetails?.videoId;if(t&&u(t))return t;let n=document.querySelector('meta[itemprop="videoId"]')?.getAttribute("content");return n&&u(n)?n:null}function g(e=nt()){return e?S(e):null}function rt(e){if(!e)return null;try{let t=new URL(e,window.location.origin).searchParams.get("v");return t&&u(t)?t:null}catch{return null}}function ot(e){if(!e)return null;try{return O(new URL(e,window.location.origin).searchParams.get("t"))}catch{return null}}async function w(e,t,n){if(!t){console.error("[Stream to MPV] Could not extract video URL"),c("Failed to extract video URL","error");return}let r=await ae();e.openInMpv(t,n,r)}function me(){let e=document.querySelector("video"),t=e?Math.floor(e.currentTime):0;return t>0?t:null}var B="mpv-open-btn";function V(e){if(!l("showButton")||document.getElementById(B))return;let t=document.querySelector(".ytp-right-controls");if(!t)return;let n=document.createElement("button");n.id=B,n.className="ytp-button",n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=L,n.style.cssText=`
    padding: 0 8px;
    min-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),w(e,g(),null)}),t.prepend(n)}function pe(){document.getElementById(B)?.remove()}var it="ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model",F=null;function st(e){return e.querySelector('a#thumbnail, a[href*="/watch"]')?.getAttribute("href")??null}function G(){document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0,cancelable:!0}))}function le(e,t){let n=document.createElement("div");n.className="ytp-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=`
    <div class="ytp-menuitem-icon">${j}</div>
    <div class="ytp-menuitem-label"></div>
    <div class="ytp-menuitem-content"></div>
  `;let r=n.querySelector(".ytp-menuitem-label");return r&&(r.textContent=e),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function at(e){let t=e.closest(".ytp-panel"),n=e.closest(".ytp-contextmenu"),r=`${e.scrollHeight}px`;e.style.height=r,t&&(t.style.height=r),n&&(n.style.height=r)}function lt(e){if(!l("enableNativeMenuItems"))return;let t=document.querySelector(".ytp-contextmenu .ytp-panel-menu");!t||t.dataset.mpvInjected||/copy video url/i.test(t.textContent??"")&&(t.dataset.mpvInjected="true",t.appendChild(le("Open in MPV",()=>{w(e,g(),null),G()})),t.appendChild(le("Open in MPV at current time",()=>{w(e,g(),me()),G()})),at(t))}function ut(e,t){let n=document.createElement("div");n.className="mpv-row-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=j;let r=document.createElement("span");return r.textContent=e,n.appendChild(r),n.addEventListener("click",o=>{o.stopPropagation(),t()}),n}function ct(e){if(!l("enableNativeMenuItems")||!F)return;let t=document.querySelector("ytd-popup-container");if(!t)return;let n=t.querySelector("tp-yt-paper-listbox#items, yt-list-view-model");!n||n.dataset.mpvInjected||/add to queue|save to playlist/i.test(n.textContent??"")&&(n.dataset.mpvInjected="true",n.appendChild(ut("Open in MPV",()=>{let r=F;r&&(w(e,g(r.videoId),r.timestamp),G())})))}var ue="";function ce(e){let t=window.location.href;t!==ue&&(ue=t,pe(),window.location.pathname.startsWith("/watch")&&setTimeout(()=>V(e),500))}var de="mpv-open-styles";function dt(){if(document.getElementById(de))return;let e=document.createElement("style");e.id=de,e.textContent=`
    @keyframes mpv-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes mpv-fade-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(10px); }
    }
    /* Overrides YouTube's "Delhi" redesign, which pads every .ytp-button svg (12px 12px) and
       would otherwise squeeze our fixed-size icon down to a sliver. The #id selector outranks
       that rule's 4 classes regardless of stylesheet order. */
    #mpv-open-btn svg {
      width: 24px;
      height: 24px;
      padding: 0;
      display: block;
    }
    .mpv-row-menuitem {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      font-size: 14px;
      line-height: 20px;
      cursor: pointer;
      color: #0f0f0f;
    }
    .mpv-row-menuitem svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .mpv-row-menuitem:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    html[dark] .mpv-row-menuitem {
      color: #fff;
    }
    html[dark] .mpv-row-menuitem:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  `,document.head.appendChild(e)}function fe(e){dt(),document.addEventListener("click",n=>{let r=n.target;if(!(r instanceof Element))return;let o=r.closest('button[aria-label="Action menu" i], button[aria-label="More actions" i]');if(!o)return;let i=o.closest(it),s=i?st(i):null,E=rt(s);F=E?{videoId:E,timestamp:ot(s)}:null},!0),new MutationObserver(()=>{ce(e),lt(e),ct(e)}).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>ce(e)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),w(e,g(),me()))}),GM_registerMenuCommand("Open current video in MPV",()=>{w(e,g(),null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=l("showButton");C("showButton",!n),n?pe():V(e)}),GM_registerMenuCommand("Toggle MPV menu items",()=>{C("enableNativeMenuItems",!l("enableNativeMenuItems"))}),window.location.pathname.startsWith("/watch")&&(document.readyState==="complete"?V(e):window.addEventListener("load",()=>V(e)))}var mt="twitch.tv";function pt(e){return{domain:e.domain,name:e.name,value:e.value,path:e.path,secure:e.secure,httpOnly:e.httpOnly,expirationDate:e.session?null:e.expirationDate??null}}function he(){return new Promise(e=>{if(typeof GM_cookie>"u"){e(null);return}try{GM_cookie.list({domain:mt},(t,n)=>{if(n||!t||t.length===0){e(null);return}e(t.map(pt))})}catch{e(null)}})}function ye(){let e=window.location.href,t=x(e);if(t)return P(t);let n=v(e);return n?R(n):null}function ve(){return ye()!==null}function ft(){let e=document.querySelector("video"),t=e?Math.floor(e.currentTime):0;return t>0?t:null}async function K(e,t){let n=ye();if(!n){console.error("[Stream to MPV] Could not extract Twitch channel/VOD URL"),c("Failed to extract video URL","error");return}let r=await he();e.openInMpv(n,t,r)}var D="mpv-open-btn-twitch";function $(e){if(!l("showButton")||document.getElementById(D))return;let t=document.querySelector(".player-controls__right-control-group");if(!t)return;let n=document.createElement("button");n.id=D,n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=L,n.style.cssText=`
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0 8px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),K(e,null)}),t.prepend(n)}function xe(){document.getElementById(D)?.remove()}var ge="mpv-open-styles-twitch";function ht(){if(document.getElementById(ge))return;let e=document.createElement("style");e.id=ge,e.textContent=`
    #${D}:hover svg {
      opacity: 0.7;
    }
  `,document.head.appendChild(e)}var we="";function be(e){let t=window.location.href;t!==we&&(we=t,xe(),ve()&&setTimeout(()=>$(e),500))}function Ce(e){ht(),new MutationObserver(()=>be(e)).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>be(e)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),K(e,ft()))}),GM_registerMenuCommand("Open current Twitch stream/VOD in MPV",()=>{K(e,null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=l("showButton");C("showButton",!n),n?xe():$(e)}),ve()&&(document.readyState==="complete"?$(e):window.addEventListener("load",()=>$(e)))}var Ee=(e,t)=>new Promise((n,r)=>{let o=GM_xmlhttpRequest({method:t?.method??"GET",url:e,...t?.headers?{headers:t.headers}:{},...t?.body!==void 0?{data:t.body}:{},onload:i=>{if(!z(i.finalUrl)){r(new Error(`response arrived via a non-loopback URL: ${i.finalUrl}`));return}n({ok:i.status>=200&&i.status<300,status:i.status,text:()=>Promise.resolve(i.responseText)})},onerror:()=>{r(new Error(`GM_xmlhttpRequest network error requesting ${e}`))}});t?.signal?.addEventListener("abort",()=>{o.abort(),r(t.signal?.reason)})});function Te(e){let t=e.toLowerCase();return t.includes("linux")?"linux":t.includes("mac")?"mac":t.includes("win")?"windows":"unknown"}var Me=new I({fetchImpl:Ee});async function ke(e,t,n,r){try{let o=await e.open(t,{timestampSeconds:n,cookies:r});c("Opening in MPV...","success",o.resolvedUrl)}catch(o){if(o instanceof f){console.error("[Stream to MPV] video source rejected the resolved URL as invalid"),c("Failed to extract video URL","error");return}if(o instanceof m){console.error("[Stream to MPV] handler unreachable:",o.message);let i=re(t,n,{mpvPath:l("mpvPath"),platform:Te(navigator.platform)}),{copied:s}=await oe(i);c(s?`Handler offline. Copied: ${i}`:`Run: ${i}`,"warning",i);return}throw o}}if(window.location.hostname.includes("twitch.tv")){let e=new U(Me);Ce({openInMpv:(t,n,r)=>ke(e,t,n,r)})}else{let e=new _(Me);fe({openInMpv:(t,n,r)=>ke(e,t,n,r)})}})();
