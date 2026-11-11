// @vitest-environment happy-dom
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GullySignIn } from './GullySignIn';
import { resetGullyIdLoader, type GullyIDGlobal } from './gullyId';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Win = { GullyID?: GullyIDGlobal };
const inits: unknown[] = [];
const renders: unknown[] = [];

beforeEach(() => {
  resetGullyIdLoader();
  inits.length = 0;
  renders.length = 0;
  // stand-in for https://gullyid.xyz/sdk.js: renderButton draws the official button into the slot
  (window as unknown as Win).GullyID = {
    init(o) {
      inits.push(o);
      return {
        handleRedirect: async () => null,
        session: () => null,
        signOut: async () => {},
        onChange: () => () => {},
        renderButton(el, opts) {
          renders.push({ theme: opts?.theme, size: opts?.size, passkey: opts?.passkey });
          const b = document.createElement('button');
          b.textContent = 'Sign in with Gully ID';
          el.appendChild(b);
          return () => b.remove();
        },
      };
    },
  };
});
afterEach(() => {
  delete (window as unknown as Win).GullyID;
  document.body.innerHTML = '';
});

async function mount(el: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(el));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return { host, root };
}

const CFG = { clientId: 'gully-bridge', issuer: 'https://gullyid.xyz' };

describe('<GullySignIn>', () => {
  it('renders the official Sign in with Gully ID button in the header', async () => {
    const { host, root } = await mount(<GullySignIn config={CFG} />);
    expect(host.querySelector('button')?.textContent).toBe('Sign in with Gully ID');
    expect((host.querySelector('.gully-id-header') as HTMLElement).hidden).toBe(false);
    expect(inits[0]).toEqual(CFG);
    expect(renders[0]).toEqual({ theme: 'dark', size: 's', passkey: false });
    expect(document.documentElement.dataset.gullyId).toBe('on');
    await act(async () => root.unmount());
  });
  it('offers the passkey option in the mobile menu', async () => {
    const { host, root } = await mount(<GullySignIn place="menu" config={CFG} />);
    expect(host.querySelector('.gully-id-menu button')?.textContent).toBe('Sign in with Gully ID');
    expect(renders[0]).toMatchObject({ passkey: true });
    await act(async () => root.unmount());
  });
  it('renders nothing when VITE_GULLY_ID_SIGNIN=off', async () => {
    const { host, root } = await mount(<GullySignIn config={null} />);
    expect(host.innerHTML).toBe('');
    expect(document.documentElement.dataset.gullyId).toBe('off');
    expect(inits).toHaveLength(0);
    await act(async () => root.unmount());
  });
});
