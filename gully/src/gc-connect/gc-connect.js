/*!
 * Gully Chain "Connect a wallet" dialog 1.1.0   GullyConnect.open({ appName, chainId, walletConnect })
 * Canonical source: gully-labs/gully-ops sites/_shared/gc-connect/gc-connect.js (spec: README.md next to it).
 * Copies live in gully-explorer, eth-faucet, hyperlane-warp-ui-template (bridge) and safe-wallet-monorepo: change the
 * canonical file, then copy it byte for byte (each copy carries the same GC_CONNECT_VERSION; repos hash-check it).
 * No dependencies, shadow DOM, kit v4 (GN 2.0) look: ink #0A0F0E, charcoal #1A1F1E panel, emerald #00C878 primary with
 * ink text, mint #2CF29A focus/live, silver #D0D5DA body, #8FA09C secondary, Inter, radius 12. No typed wordmark: the
 * dialog names the action, not the brand.
 *
 * Order (owner, 2026-10-30):
 * 1.1.0 (2026-10-30, owner): row 1 reads "Sign in with Gully ID" in every dialog (data-gcc="gully-id", checked
 *   headlessly after each deploy by gully-ops scripts/check-gully-id-connect.mjs).
 *   1. Sign in with Gully ID = the Gully Wallet (Gully ID passkey): the EIP-1193 provider from https://gullyid.xyz/wallet.js (window.gully,
 *      EIP-6963 rdns xyz.gullyid.wallet). The script is preloaded when the dialog opens, so eth_requestAccounts (which
 *      opens the gullyid.xyz approval pop-up) still runs inside the user's click.
 *   2. WalletConnect (QR): the host passes `walletConnect: () => Promise<EIP-1193 provider>`; without it the row says
 *      WalletConnect is not enabled on this site (no project id).
 *   3. Every wallet the browser announces over EIP-6963 (and a legacy window.ethereum if nothing announces).
 *   4. MetaMask, Rabby and Coinbase Wallet, each with its install link, when not detected.
 *
 * API (window.GullyConnect):
 *   open(opts) -> Promise<{ kind: 'gully'|'walletconnect'|'injected', id, name, icon, rdns, provider, accounts }>
 *     opts.appName        shown in the dialog title ("Connect a wallet to <appName>")
 *     opts.chainId        number; after connecting, wallet_switchEthereumChain is NOT sent (the host decides)
 *     opts.walletConnect  async () => provider   (host-supplied: wagmi/onboard/@walletconnect/ethereum-provider)
 *     opts.gullyWallet    false hides row 1; or { src } to load the SDK from another issuer
 *     opts.request        true (default): the dialog calls eth_requestAccounts and returns `accounts`;
 *                         false: it returns the provider only (wagmi / web3-onboard do their own connect)
 *   Rejects with { code: 4001 } when the user closes the dialog.
 *   discover(ms = 300) -> Promise<Array<{ info, provider }>>   EIP-6963 providers seen so far
 *   INSTALL            the install list (rdns, name, url)
 *   VERSION
 */
(function (root) {
  'use strict';
  if (typeof root === 'undefined' || root.GullyConnect) return;

  var GC_CONNECT_VERSION = '1.1.0';
  var GULLY_WALLET_SRC = 'https://gullyid.xyz/wallet.js';
  var GULLY_RDNS = 'xyz.gullyid.wallet';
  var INSTALL = [
    { rdns: 'io.metamask', name: 'MetaMask', url: 'https://metamask.io/download/' },
    { rdns: 'io.rabby', name: 'Rabby', url: 'https://rabby.io/' },
    { rdns: 'com.coinbase.wallet', name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet/downloads' }
  ];
  // Lucide (ISC) glyphs, 20 px, stroke 1.75: never third-party logos redrawn.
  var ICONS = {
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/><path d="M20 12v4h-3a2 2 0 0 1 0-4Z"/>',
    passkey: '<circle cx="10" cy="7" r="4"/><path d="M10.3 15H7a4 4 0 0 0-4 4v2"/><circle cx="17" cy="16" r="3"/><path d="m21 20-1.9-1.9"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function svg(name) {
    return '<svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // EIP-6963 icons are data: URIs by spec; anything else is dropped (no remote images, no javascript:).
  function safeIcon(u) { return typeof u === 'string' && /^data:image\/(png|svg\+xml|webp|jpeg|gif);/i.test(u) ? u : null; }
  function err(code, message) { var e = new Error(message); e.code = code; return e; }

  // ---------- EIP-6963 discovery (always listening once this file loads) ----------
  var seen = [];
  function onAnnounce(ev) {
    var d = ev && ev.detail;
    if (!d || !d.info || !d.provider || typeof d.provider.request !== 'function') return;
    for (var i = 0; i < seen.length; i++) if (seen[i].info.uuid === d.info.uuid || (d.info.rdns && seen[i].info.rdns === d.info.rdns)) return;
    seen.push({ info: d.info, provider: d.provider });
    if (current) current.render();
  }
  if (root.addEventListener) {
    root.addEventListener('eip6963:announceProvider', onAnnounce);
    try { root.dispatchEvent(new Event('eip6963:requestProvider')); } catch (e) { /* very old browser */ }
  }
  function discover(ms) {
    try { root.dispatchEvent(new Event('eip6963:requestProvider')); } catch (e) { /* ignore */ }
    return new Promise(function (r) { setTimeout(function () { r(seen.slice()); }, ms == null ? 300 : ms); });
  }

  // ---------- Gully Wallet SDK loader ----------
  var gullyLoad = null;
  function loadGully(src) {
    if (root.gully && typeof root.gully.request === 'function') return Promise.resolve(root.gully);
    if (gullyLoad) return gullyLoad;
    gullyLoad = new Promise(function (resolve, reject) {
      var s = root.document.createElement('script');
      s.src = src || GULLY_WALLET_SRC;
      s.async = true;
      s.referrerPolicy = 'strict-origin';
      var t = setTimeout(function () { fail('Gully Wallet took too long to load'); }, 12000);
      function fail(m) { clearTimeout(t); gullyLoad = null; s.remove(); reject(err(-32603, m)); }
      s.onload = function () {
        clearTimeout(t);
        if (root.gully && typeof root.gully.request === 'function') resolve(root.gully);
        else fail('Gully Wallet did not start');
      };
      s.onerror = function () { fail('Gully Wallet could not load (blocked or offline)'); };
      root.document.head.appendChild(s);
    });
    return gullyLoad;
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    'dialog{border:0;padding:0;margin:auto;max-width:calc(100vw - 24px);width:420px;background:#1A1F1E;color:#D0D5DA;border-radius:16px;',
    'box-shadow:0 24px 64px rgba(0,0,0,.6),0 0 0 1px rgba(208,213,218,.12);font:400 14px/1.45 Inter,"Inter var",system-ui,-apple-system,"Segoe UI",sans-serif}',
    'dialog::backdrop{background:rgba(10,15,14,.72);backdrop-filter:blur(4px)}',
    '.hd{display:flex;align-items:center;gap:12px;padding:18px 18px 6px}',
    '.hd h2{flex:1;margin:0;font:700 17px/1.3 Inter,system-ui,sans-serif;color:#fff;letter-spacing:-.01em}',
    '.sub{margin:0;padding:0 18px 12px;color:#8FA09C;font-size:13px}',
    '.x{all:unset;cursor:pointer;width:32px;height:32px;display:grid;place-items:center;border-radius:10px;color:#8FA09C}',
    '.x:hover{background:#0A0F0E;color:#fff}.x:focus-visible,.row:focus-visible{outline:2px solid #2CF29A;outline-offset:2px}',
    '.ic{flex:none}',
    '.lab{margin:10px 18px 6px;font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8FA09C}',
    'ul{list-style:none;margin:0;padding:0 10px 4px}',
    '.row{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:10px 12px;border-radius:12px;',
    'color:#fff;transition:background 120ms,transform 120ms}',
    '.row:hover{background:#0A0F0E}.row:active{transform:scale(.98)}',
    '.row[aria-disabled="true"]{cursor:default;opacity:.62}.row[aria-disabled="true"]:hover{background:none}',
    '.ico{width:36px;height:36px;flex:none;border-radius:10px;display:grid;place-items:center;background:#0A0F0E;color:#2CF29A;border:1px solid rgba(208,213,218,.12);overflow:hidden}',
    '.ico img{width:28px;height:28px;object-fit:contain}',
    '.t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
    '.t b{font:600 14px/1.25 Inter,system-ui,sans-serif;color:#fff}',
    '.t span{font-size:12px;color:#8FA09C;overflow-wrap:anywhere}',
    '.tag{flex:none;font:600 11px/1 Inter,system-ui,sans-serif;padding:5px 8px;border-radius:999px;background:#005B39;color:#2CF29A}',
    '.pri .ico{background:#00C878;color:#0A0F0E;border-color:#00C878}',
    '.go{color:#8FA09C;transition:transform 120ms}.row:hover .go{transform:translateX(3px);color:#2CF29A}',
    '.msg{margin:8px 18px 0;padding:10px 12px;border-radius:12px;font-size:13px;background:#0A0F0E;border:1px solid rgba(208,213,218,.12)}',
    '.msg.err{border-color:rgba(239,68,68,.5);color:#FCA5A5}.msg.busy{color:#2CF29A}',
    '.ft{padding:10px 18px 16px;color:#8FA09C;font-size:12px}',
    '.ft a{color:#2CF29A}',
    '@media (prefers-reduced-motion:reduce){.row,.go{transition:none}.row:active{transform:none}}'
  ].join('');

  var current = null;

  function Dialog(opts, resolve, reject) {
    var self = this;
    var host = root.document.createElement('gc-connect-dialog');
    var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var dlg = root.document.createElement('dialog');
    dlg.setAttribute('aria-labelledby', 'gcc-title');
    var style = root.document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);
    shadow.appendChild(dlg);
    root.document.body.appendChild(host);

    var status = null; // { kind: 'busy'|'err', text }
    var busy = false;
    var gullyReady = !!(root.gully && root.gully.request);
    var gullyFailed = null;
    var wantGully = opts.gullyWallet !== false;
    var gullySrc = opts.gullyWallet && opts.gullyWallet.src;
    if (wantGully && !gullyReady) {
      loadGully(gullySrc).then(function () { gullyReady = true; self.render(); }, function (e) { gullyFailed = e.message; self.render(); });
    }

    function done(result) { self.close(); resolve(result); }
    function cancel() { self.close(); reject(err(4001, 'The user closed the wallet dialog')); }

    function finish(kind, meta, provider) {
      if (opts.request === false) return done({ kind: kind, id: meta.id, name: meta.name, icon: meta.icon || null, rdns: meta.rdns || null, provider: provider, accounts: [] });
      status = { kind: 'busy', text: 'Confirm in ' + meta.name + '…' };
      busy = true; self.render();
      var p;
      try { p = provider.request({ method: 'eth_requestAccounts' }); } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(function (accounts) {
        done({ kind: kind, id: meta.id, name: meta.name, icon: meta.icon || null, rdns: meta.rdns || null, provider: provider, accounts: accounts || [] });
      }, function (e) {
        busy = false;
        status = { kind: 'err', text: (e && e.code === 4001) ? meta.name + ': request rejected. Pick a wallet to try again.' : (meta.name + ': ' + ((e && e.message) || 'could not connect')) };
        self.render();
      });
    }

    function pick(id) {
      if (busy) return;
      if (id === 'gully') {
        if (!gullyReady) return;
        return finish('gully', { id: 'gully', name: 'Gully Wallet', rdns: GULLY_RDNS, icon: gullyIcon() }, root.gully);
      }
      if (id === 'walletconnect') {
        if (typeof opts.walletConnect !== 'function') return;
        busy = true; status = { kind: 'busy', text: 'Opening the WalletConnect QR code…' }; self.render();
        var hidden = false;
        // the WalletConnect modal draws its own QR; hide ours so the two never stack
        try { dlg.close(); hidden = true; } catch (e) { /* ignore */ }
        Promise.resolve().then(function () { return opts.walletConnect(); }).then(function (provider) {
          if (!provider) throw err(4001, 'WalletConnect was closed');
          if (hidden) { try { dlg.showModal(); } catch (e) { /* ignore */ } }
          busy = false;
          finish('walletconnect', { id: 'walletconnect', name: 'WalletConnect' }, provider);
        }, function (e) {
          if (hidden) { try { dlg.showModal(); } catch (x) { /* ignore */ } }
          busy = false;
          status = { kind: 'err', text: (e && e.code === 4001) ? 'WalletConnect closed. Pick a wallet to try again.' : 'WalletConnect: ' + ((e && e.message) || 'could not connect') };
          self.render();
        });
        return;
      }
      var w = injectedList()[Number(id.slice(4))];
      if (w) finish('injected', { id: w.info.rdns || w.info.uuid, name: w.info.name, rdns: w.info.rdns, icon: safeIcon(w.info.icon) }, w.provider);
    }

    function gullyIcon() {
      for (var i = 0; i < seen.length; i++) if (seen[i].info.rdns === GULLY_RDNS) return safeIcon(seen[i].info.icon);
      return null;
    }
    function injectedList() {
      var list = seen.filter(function (w) { return w.info.rdns !== GULLY_RDNS; });
      if (!list.length && root.ethereum && typeof root.ethereum.request === 'function' && !root.ethereum.isGullyWallet) {
        list = [{ info: { uuid: 'legacy', name: root.ethereum.isMetaMask ? 'Browser wallet (MetaMask)' : 'Browser wallet', rdns: '', icon: null }, provider: root.ethereum }];
      }
      return list;
    }

    function row(id, ico, title, sub, extra, attrs) {
      return '<li><button type="button" class="row' + (attrs && attrs.pri ? ' pri' : '') + '" data-id="' + id + '"' + (attrs && attrs.gcc ? ' data-gcc="' + attrs.gcc + '"' : '') + (attrs && attrs.disabled ? ' aria-disabled="true"' : '') + '>' +
        '<span class="ico">' + ico + '</span><span class="t"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></span>' + (extra || '<span class="go">' + svg('arrow') + '</span>') + '</button></li>';
    }

    this.render = function () {
      var app = opts.appName ? ' to ' + esc(opts.appName) : '';
      var h = '<div class="hd"><h2 id="gcc-title">Connect a wallet' + app + '</h2><button type="button" class="x" data-x aria-label="Close">' + svg('x') + '</button></div>';
      h += '<p class="sub">Pick how you sign. Gully Wallet needs no extension or seed phrase: your passkey is the key.</p>';
      if (status) h += '<p class="msg ' + status.kind + '" role="' + (status.kind === 'err' ? 'alert' : 'status') + '">' + esc(status.text) + '</p>';
      h += '<p class="lab">Recommended</p><ul>';
      if (wantGully) {
        var gi = gullyIcon();
        h += row('gully', gi ? '<img src="' + gi + '" alt="">' : svg('passkey'), 'Sign in with Gully ID', gullyFailed ? gullyFailed : (gullyReady ? 'Gully Wallet: your passkey is the key, no extension' : 'Loading Gully Wallet…'), '<span class="tag">Passkey</span>', { pri: true, disabled: !gullyReady, gcc: 'gully-id' });
      }
      var wc = typeof opts.walletConnect === 'function';
      h += row('walletconnect', svg('qr'), 'WalletConnect', wc ? 'Scan a QR code with a mobile wallet' : 'Not enabled on this site yet', wc ? '' : '<span class="tag">Soon</span>', { disabled: !wc });
      h += '</ul>';
      var inj = injectedList();
      if (inj.length) {
        h += '<p class="lab">Detected in this browser</p><ul>';
        inj.forEach(function (w, i) {
          var ic = safeIcon(w.info.icon);
          h += row('inj-' + i, ic ? '<img src="' + ic + '" alt="">' : svg('plug'), w.info.name || 'Browser wallet', 'Installed', '', {});
        });
        h += '</ul>';
      }
      var missing = INSTALL.filter(function (x) { return !seen.some(function (w) { return w.info.rdns === x.rdns; }); });
      if (missing.length) {
        h += '<p class="lab">Get a wallet</p><ul>';
        missing.forEach(function (x) {
          h += '<li><a class="row" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer"><span class="ico">' + svg('download') + '</span><span class="t"><b>' + esc(x.name) + '</b><span>Install, then come back and pick it here<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"> (opens in a new tab)</span></span></span><span class="go">' + svg('arrow') + '</span></a></li>';
        });
        h += '</ul>';
      }
      h += '<p class="ft">New to wallets? <a href="https://docs.gullychain.xyz/getting-started/" target="_blank" rel="noopener noreferrer">How wallets work on Gully Chain</a></p>';
      dlg.innerHTML = h;
    };

    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) return cancel(); // backdrop
      var t = ev.target.closest && ev.target.closest('[data-id],[data-x]');
      if (!t) return;
      if (t.hasAttribute('data-x')) return cancel();
      if (t.getAttribute('aria-disabled') === 'true') return;
      pick(t.getAttribute('data-id'));
    });
    dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); if (!busy) cancel(); });

    this.close = function () {
      if (current === self) current = null;
      try { dlg.close(); } catch (e) { /* ignore */ }
      host.remove();
    };

    this.render();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var first = dlg.querySelector('.row:not([aria-disabled="true"])');
    if (first) first.focus();
  }

  function open(opts) {
    opts = opts || {};
    if (current) current.close();
    return new Promise(function (resolve, reject) {
      current = new Dialog(opts, resolve, reject);
    });
  }

  var api = { VERSION: GC_CONNECT_VERSION, open: open, discover: discover, INSTALL: INSTALL, GULLY_WALLET_SRC: GULLY_WALLET_SRC, GULLY_RDNS: GULLY_RDNS };
  root.GullyConnect = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : undefined);
