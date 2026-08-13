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


"use strict";(()=>{var Ot=Object.defineProperty;var Pt=(t,e,n)=>e in t?Ot(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var a=(t,e,n)=>Pt(t,typeof e!="symbol"?e+"":e,n);var p=class extends Error{constructor(e,n){super(e,n),this.name=new.target.name}},b=class extends p{},T=class extends b{},M=class extends p{constructor(n,r,o){super(n);a(this,"statusCode");a(this,"body");this.statusCode=r,this.body=o}},y=class extends p{};var St=/[\t\n]/,_t=["domain","name","value","path","secure","httpOnly","expirationDate"];function Lt(t){return typeof t=="object"&&t!==null&&!Array.isArray(t)}function I(t,e,n){if(t===void 0){if(n)throw new RangeError(`cookie ${e} is required`);return}if(typeof t!="string")throw new RangeError(`cookie ${e} must be a string`);if(t.length>4096)throw new RangeError(`cookie ${e} exceeds 4096 characters`);if(St.test(t))throw new RangeError(`cookie ${e} contains a forbidden control character`);if(n&&t.length===0)throw new RangeError(`cookie ${e} must not be empty`);return t}function Vt(t){if(!Lt(t))throw new RangeError("cookie entry must be an object");let e=Object.keys(t).find(s=>!_t.includes(s));if(e)throw new RangeError(`unexpected cookie field "${e}"`);let n=I(t.domain,"domain",!0),r=I(t.name,"name",!0),o=I(t.value,"value",!1)??"",i=I(t.path,"path",!1);if(t.secure!==void 0&&typeof t.secure!="boolean")throw new RangeError("cookie secure must be a boolean");if(t.httpOnly!==void 0&&typeof t.httpOnly!="boolean")throw new RangeError("cookie httpOnly must be a boolean");if(t.expirationDate!==void 0&&t.expirationDate!==null&&!(typeof t.expirationDate=="number"&&Number.isFinite(t.expirationDate)))throw new RangeError("cookie expirationDate must be a finite number or null");return{domain:n,name:r,value:o,...i!==void 0?{path:i}:{},...t.secure!==void 0?{secure:t.secure}:{},...t.httpOnly!==void 0?{httpOnly:t.httpOnly}:{},...t.expirationDate!==void 0?{expirationDate:t.expirationDate}:{}}}function q(t){if(t==null)return null;if(!Array.isArray(t))throw new RangeError("cookies must be an array");if(t.length===0)return null;if(t.length>200)throw new RangeError("cookies exceeds the maximum of 200 entries");return t.map(Vt)}var W=new Set(["127.0.0.1","localhost","[::1]"]);function H(t){let e=new URL(t);if(e.protocol!=="http:")throw new RangeError(`mpv-handler base URL must use http:, got "${e.protocol}"`);if(e.username||e.password)throw new RangeError("mpv-handler base URL must not contain credentials");if(!W.has(e.hostname)){let n=[...W].join(", ");throw new RangeError(`mpv-handler base URL host must be loopback (one of ${n}), got "${e.hostname}"`)}}function z(t){try{return H(t),!0}catch{return!1}}function X(t){return typeof t=="object"&&t!==null&&!Array.isArray(t)}function J(t,e){return Object.keys(t).find(n=>!e.includes(n))}var Z={safeParse(t){if(!X(t))return{success:!1,error:{message:"expected an object"}};let e=J(t,["status","message"]);return e?{success:!1,error:{message:`unexpected key "${e}"`}}:t.status!=="ok"&&t.status!=="error"?{success:!1,error:{message:'status must be "ok" or "error"'}}:t.message!==void 0&&typeof t.message!="string"?{success:!1,error:{message:"message must be a string"}}:{success:!0,data:t.message!==void 0?{status:t.status,message:t.message}:{status:t.status}}}},Q={safeParse(t){if(!X(t))return{success:!1,error:{message:"expected an object"}};let e=J(t,["status"]);return e?{success:!1,error:{message:`unexpected key "${e}"`}}:t.status!=="running"?{success:!1,error:{message:'status must be "running"'}}:{success:!0,data:{status:"running"}}}};var $t="http://127.0.0.1:38421",Dt=5e3;function Ht(t){return typeof t=="object"&&t!==null&&"message"in t&&typeof t.message=="string"}var k=class{constructor(e={}){a(this,"baseUrl");a(this,"timeoutMs");a(this,"fetchImpl");this.baseUrl=e.baseUrl??$t,this.timeoutMs=e.timeoutMs??Dt,this.fetchImpl=e.fetchImpl??fetch,e.allowNonLoopback?console.warn(`[Stream to MPV] MpvHandlerClient constructed with allowNonLoopback=true for baseUrl "${this.baseUrl}" \u2014 the loopback SSRF guard is disabled for this instance.`):H(this.baseUrl)}async play(e,n={}){let r=n.timestampSeconds??null;if(r!==null&&!(Number.isFinite(r)&&r>=0))throw new RangeError(`timestampSeconds must be a finite number >= 0, got ${String(r)}`);let o=q(n.cookies);return this.requestJson("/play",{url:e,t:r!==null?String(r):void 0,cookies:o??void 0},Z)}async health(){return this.request("/health",{},Q)}buildRequestUrl(e,n){let r=Object.entries(n).filter(i=>i[1]!==void 0).map(([i,s])=>`${i}=${encodeURIComponent(s)}`),o=r.length>0?`?${r.join("&")}`:"";return`${this.baseUrl}${e}${o}`}async request(e,n,r){let o=await this.fetch(this.buildRequestUrl(e,n),e,{signal:AbortSignal.timeout(this.timeoutMs)});return this.parseResponse(o,r)}async requestJson(e,n,r){let o=await this.fetch(`${this.baseUrl}${e}`,e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n),signal:AbortSignal.timeout(this.timeoutMs)});return this.parseResponse(o,r)}async fetch(e,n,r){try{return await this.fetchImpl(e,r)}catch(o){throw o instanceof Error&&o.name==="TimeoutError"?new T(`mpv-handler did not respond within ${this.timeoutMs}ms (${this.baseUrl}${n})`,{cause:o}):new b(`mpv-handler unreachable at ${this.baseUrl}`,{cause:o})}}async parseResponse(e,n){let r=await e.text(),o;try{o=r.length>0?JSON.parse(r):void 0}catch(s){throw new y("mpv-handler returned a non-JSON response",{cause:s})}if(!e.ok){let s=Ht(o)?o.message:`HTTP ${e.status}`;throw new M(`mpv-handler rejected the request: ${s}`,e.status,o)}let i=n.safeParse(o);if(!i.success)throw new y(`mpv-handler response failed validation: ${i.error.message}`);return i.data}};var f=class extends Error{};var h=class{constructor(e){a(this,"client");this.client=e}async open(e,n={}){let r=this.resolveUrl(e);if(!r)throw new f(`${this.platform}: not a valid URL or ID: ${e}`);let o=n.timestampSeconds??null,i=n.cookies??null;return await this.client.play(r,{timestampSeconds:o,cookies:i}),{resolvedUrl:r,timestampSeconds:o}}};var At=new Set(["www.twitch.tv","twitch.tv","m.twitch.tv"]),Nt=/^[a-zA-Z0-9_]{4,25}$/,jt=/^\/videos\/(\d+)$/,Bt=new Set(["videos","directory","settings","subscriptions","p","jobs","turbo","login","signup","moderator","friends","inventory","wallet","drops","payments","following","search"]);function A(t){return Nt.test(t)&&!Bt.has(t.toLowerCase())}function tt(t){return/^\d+$/.test(t)}function et(t){if(t.protocol!=="https:"||t.username||t.password||!At.has(t.hostname))return null;let e=jt.exec(t.pathname);if(e){let r=e[1];return r&&tt(r)?{kind:"vod",value:r}:null}let n=/^\/([^/]+)$/.exec(t.pathname);if(n){let r=n[1];if(r&&A(r))return{kind:"channel",value:r}}return null}function v(t){let e=t.trim();if(A(e))return e;try{let n=et(new URL(e));return n?.kind==="channel"?n.value:null}catch{return null}}function x(t){try{let e=et(new URL(t.trim()));return e?.kind==="vod"?e.value:null}catch{return null}}function R(t){return A(t)?`https://www.twitch.tv/${t}`:null}function U(t){return tt(t)?`https://www.twitch.tv/videos/${t}`:null}var Ft=/^\d+$/,Gt=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function nt(t){if(!t)return null;if(Ft.test(t))return parseInt(t,10);let e=Gt.exec(t);if(!e||!(e[1]||e[2]||e[3]))return null;let n=parseInt(e[1]??"0",10),r=parseInt(e[2]??"0",10),o=parseInt(e[3]??"0",10);return n*3600+r*60+o}var O=class extends h{constructor(){super(...arguments);a(this,"platform","twitch")}supports(n){return x(n)!==null||v(n)!==null}resolveUrl(n){let r=x(n);if(r)return U(r);let o=v(n);return o?R(o):null}parseTimestamp(n){return nt(n)}};var Kt=/^[a-zA-Z0-9_-]{11}$/,Yt=new Set(["www.youtube.com","youtube.com","m.youtube.com"]),qt="youtu.be",Wt=/^\/shorts\/([^/]+)$/;function u(t){return Kt.test(t)}function zt(t){if(t.protocol!=="https:"||t.username||t.password)return null;if(Yt.has(t.hostname)){if(t.pathname==="/watch"){let n=t.searchParams.get("v");return n&&u(n)?n:null}let e=Wt.exec(t.pathname);if(e){let n=e[1];if(n&&u(n))return n}return null}if(t.hostname===qt){let e=t.pathname.slice(1);if(u(e))return e}return null}function N(t){let e=t.trim();if(u(e))return e;try{return zt(new URL(e))}catch{return null}}function P(t){return u(t)?`https://www.youtube.com/watch?v=${t}`:null}var Xt=/^\d+$/,Jt=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;function S(t){if(!t)return null;if(Xt.test(t))return parseInt(t,10);let e=Jt.exec(t);if(!e||!(e[1]||e[2]||e[3]))return null;let n=parseInt(e[1]??"0",10),r=parseInt(e[2]??"0",10),o=parseInt(e[3]??"0",10);return n*3600+r*60+o}var _=class extends h{constructor(){super(...arguments);a(this,"platform","youtube")}supports(n){return N(n)!==null}resolveUrl(n){let r=N(n);return r?P(r):null}parseTimestamp(n){return S(n)}};function rt(t,e,n={}){let r=n.mpvPath??"mpv",o=n.platform==="windows",i=e!==null?` --start=${e}`:"";return o?`"${r}" "${t}"${i}`:`'${r}' '${t}'${i}`}async function ot(t){try{return await navigator.clipboard.writeText(t),{copied:!0}}catch{return{copied:!1}}}var Zt={mpvPath:"mpv",showButton:!0,autoPlaylist:!1,enableNativeMenuItems:!0};function l(t){return GM_getValue(t,Zt[t])}function C(t,e){GM_setValue(t,e)}var it=`
  <path d="M8 5v14l11-7z"/>
  <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
`,L=`<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${it}</svg>`,j=`<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${it}</svg>`;var st="mpv-toast";function c(t,e,n){document.getElementById(st)?.remove();let r=window.matchMedia("(prefers-color-scheme: dark)").matches,o=e==="error",i=o?"#e74c3c":r?"#333":"#fff",s=o||r?"#fff":"#333",E=o?"transparent":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",kt=o?"rgba(255,255,255,0.2)":r?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.05)",Rt=o?"rgba(255,255,255,0.3)":r?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.1)",Ut=o||r?"#fff":"#333",d=document.createElement("div");d.id=st,d.style.cssText=`
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
  `;let Y=document.createElement("span");if(Y.textContent=t,d.appendChild(Y),n!==void 0){let m=document.createElement("button");m.textContent="Copy",m.style.cssText=`
      background: ${kt};
      border: 1px solid ${Rt};
      color: ${Ut};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `,m.onclick=()=>{navigator.clipboard.writeText(n).then(()=>{m.textContent="Copied!",setTimeout(()=>{m.textContent="Copy"},1e3)}).catch(()=>{})},d.appendChild(m)}document.body.appendChild(d),setTimeout(()=>{d.style.animation="mpv-fade-out 0.3s ease",setTimeout(()=>d.remove(),300)},5e3)}var Qt="youtube.com";function te(t){return{domain:t.domain,name:t.name,value:t.value,path:t.path,secure:t.secure,httpOnly:t.httpOnly,expirationDate:t.session?null:t.expirationDate??null}}function at(){return new Promise(t=>{if(typeof GM_cookie>"u"){t(null);return}try{GM_cookie.list({domain:Qt},(e,n)=>{if(n||!e||e.length===0){t(null);return}t(e.map(te))})}catch{t(null)}})}function ee(){let t=/[?&]v=([^&]+)/.exec(window.location.search);if(t?.[1]&&u(t[1]))return t[1];let e=window.ytInitialPlayerResponse?.videoDetails?.videoId;if(e&&u(e))return e;let n=document.querySelector('meta[itemprop="videoId"]')?.getAttribute("content");return n&&u(n)?n:null}function g(t=ee()){return t?P(t):null}function ne(t){if(!t)return null;try{let e=new URL(t,window.location.origin).searchParams.get("v");return e&&u(e)?e:null}catch{return null}}function re(t){if(!t)return null;try{return S(new URL(t,window.location.origin).searchParams.get("t"))}catch{return null}}async function w(t,e,n){if(!e){console.error("[Stream to MPV] Could not extract video URL"),c("Failed to extract video URL","error");return}let r=await at();t.openInMpv(e,n,r)}function pt(){let t=document.querySelector("video"),e=t?Math.floor(t.currentTime):0;return e>0?e:null}var B="mpv-open-btn";function V(t){if(!l("showButton")||document.getElementById(B))return;let e=document.querySelector(".ytp-right-controls");if(!e)return;let n=document.createElement("button");n.id=B,n.className="ytp-button",n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=L,n.style.cssText=`
    padding: 0 8px;
    min-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),w(t,g(),null)}),e.prepend(n)}function mt(){document.getElementById(B)?.remove()}var oe="ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model",F=null;function ie(t){return t.querySelector('a#thumbnail, a[href*="/watch"]')?.getAttribute("href")??null}function G(){document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0,cancelable:!0}))}function lt(t,e){let n=document.createElement("div");n.className="ytp-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=`
    <div class="ytp-menuitem-icon">${j}</div>
    <div class="ytp-menuitem-label"></div>
    <div class="ytp-menuitem-content"></div>
  `;let r=n.querySelector(".ytp-menuitem-label");return r&&(r.textContent=t),n.addEventListener("click",o=>{o.stopPropagation(),e()}),n}function se(t){let e=t.closest(".ytp-panel"),n=t.closest(".ytp-contextmenu"),r=`${t.scrollHeight}px`;t.style.height=r,e&&(e.style.height=r),n&&(n.style.height=r)}function ae(t){if(!l("enableNativeMenuItems"))return;let e=document.querySelector(".ytp-contextmenu .ytp-panel-menu");!e||e.dataset.mpvInjected||/copy video url/i.test(e.textContent??"")&&(e.dataset.mpvInjected="true",e.appendChild(lt("Open in MPV",()=>{w(t,g(),null),G()})),e.appendChild(lt("Open in MPV at current time",()=>{w(t,g(),pt()),G()})),se(e))}function le(t,e){let n=document.createElement("div");n.className="mpv-row-menuitem",n.setAttribute("role","menuitem"),n.tabIndex=0,n.innerHTML=j;let r=document.createElement("span");return r.textContent=t,n.appendChild(r),n.addEventListener("click",o=>{o.stopPropagation(),e()}),n}function ue(t){if(!l("enableNativeMenuItems")||!F)return;let e=document.querySelector("ytd-popup-container");if(!e)return;let n=e.querySelector("tp-yt-paper-listbox#items, yt-list-view-model");!n||n.dataset.mpvInjected||/add to queue|save to playlist/i.test(n.textContent??"")&&(n.dataset.mpvInjected="true",n.appendChild(le("Open in MPV",()=>{let r=F;r&&(w(t,g(r.videoId),r.timestamp),G())})))}var ut="";function ct(t){let e=window.location.href;e!==ut&&(ut=e,mt(),window.location.pathname.startsWith("/watch")&&setTimeout(()=>V(t),500))}var dt="mpv-open-styles";function ce(){if(document.getElementById(dt))return;let t=document.createElement("style");t.id=dt,t.textContent=`
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
  `,document.head.appendChild(t)}function ft(t){ce(),document.addEventListener("click",n=>{let r=n.target;if(!(r instanceof Element))return;let o=r.closest('button[aria-label="Action menu" i], button[aria-label="More actions" i]');if(!o)return;let i=o.closest(oe),s=i?ie(i):null,E=ne(s);F=E?{videoId:E,timestamp:re(s)}:null},!0),new MutationObserver(()=>{ct(t),ae(t),ue(t)}).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>ct(t)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),w(t,g(),pt()))}),GM_registerMenuCommand("Open current video in MPV",()=>{w(t,g(),null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=l("showButton");C("showButton",!n),n?mt():V(t)}),GM_registerMenuCommand("Toggle MPV menu items",()=>{C("enableNativeMenuItems",!l("enableNativeMenuItems"))}),window.location.pathname.startsWith("/watch")&&(document.readyState==="complete"?V(t):window.addEventListener("load",()=>V(t)))}var de="twitch.tv";function pe(t){return{domain:t.domain,name:t.name,value:t.value,path:t.path,secure:t.secure,httpOnly:t.httpOnly,expirationDate:t.session?null:t.expirationDate??null}}function ht(){return new Promise(t=>{if(typeof GM_cookie>"u"){t(null);return}try{GM_cookie.list({domain:de},(e,n)=>{if(n||!e||e.length===0){t(null);return}t(e.map(pe))})}catch{t(null)}})}function yt(){let t=window.location.href,e=x(t);if(e)return U(e);let n=v(t);return n?R(n):null}function vt(){return yt()!==null}function me(){let t=document.querySelector("video"),e=t?Math.floor(t.currentTime):0;return e>0?e:null}async function K(t,e){let n=yt();if(!n){console.error("[Stream to MPV] Could not extract Twitch channel/VOD URL"),c("Failed to extract video URL","error");return}let r=await ht();t.openInMpv(n,e,r)}var D="mpv-open-btn-twitch";function $(t){if(!l("showButton")||document.getElementById(D))return;let e=document.querySelector(".player-controls__right-control-group");if(!e)return;let n=document.createElement("button");n.id=D,n.title="Open in MPV (Ctrl+Shift+M)",n.innerHTML=L,n.style.cssText=`
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0 8px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `,n.addEventListener("click",r=>{r.stopPropagation(),K(t,null)}),e.prepend(n)}function xt(){document.getElementById(D)?.remove()}var gt="mpv-open-styles-twitch";function fe(){if(document.getElementById(gt))return;let t=document.createElement("style");t.id=gt,t.textContent=`
    #${D}:hover svg {
      opacity: 0.7;
    }
  `,document.head.appendChild(t)}var wt="";function bt(t){let e=window.location.href;e!==wt&&(wt=e,xt(),vt()&&setTimeout(()=>$(t),500))}function Ct(t){fe(),new MutationObserver(()=>bt(t)).observe(document.body,{childList:!0,subtree:!0}),window.addEventListener("popstate",()=>bt(t)),document.addEventListener("keydown",n=>{n.ctrlKey&&n.shiftKey&&n.key==="M"&&(n.preventDefault(),K(t,me()))}),GM_registerMenuCommand("Open current Twitch stream/VOD in MPV",()=>{K(t,null)}),GM_registerMenuCommand("Toggle button visibility",()=>{let n=l("showButton");C("showButton",!n),n?xt():$(t)}),vt()&&(document.readyState==="complete"?$(t):window.addEventListener("load",()=>$(t)))}var Et=(t,e)=>new Promise((n,r)=>{let o=GM_xmlhttpRequest({method:e?.method??"GET",url:t,...e?.headers?{headers:e.headers}:{},...e?.body!==void 0?{data:e.body}:{},onload:i=>{if(!z(i.finalUrl)){r(new Error(`response arrived via a non-loopback URL: ${i.finalUrl}`));return}n({ok:i.status>=200&&i.status<300,status:i.status,text:()=>Promise.resolve(i.responseText)})},onerror:()=>{r(new Error(`GM_xmlhttpRequest network error requesting ${t}`))}});e?.signal?.addEventListener("abort",()=>{o.abort(),r(e.signal?.reason)})});function Tt(t){let e=t.toLowerCase();return e.includes("linux")?"linux":e.includes("mac")?"mac":e.includes("win")?"windows":"unknown"}var Mt=new k({fetchImpl:Et});async function It(t,e,n,r){try{let o=await t.open(e,{timestampSeconds:n,cookies:r});c("Opening in MPV...","success",o.resolvedUrl)}catch(o){if(o instanceof f){console.error("[Stream to MPV] video source rejected the resolved URL as invalid"),c("Failed to extract video URL","error");return}if(o instanceof p){console.error("[Stream to MPV] handler unreachable:",o.message);let i=rt(e,n,{mpvPath:l("mpvPath"),platform:Tt(navigator.platform)}),{copied:s}=await ot(i);c(s?`Handler offline. Copied: ${i}`:`Run: ${i}`,"warning",i);return}throw o}}if(window.location.hostname.includes("twitch.tv")){let t=new O(Mt);Ct({openInMpv:(e,n,r)=>It(t,e,n,r)})}else{let t=new _(Mt);ft({openInMpv:(e,n,r)=>It(t,e,n,r)})}})();
