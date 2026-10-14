import { expect, type Locator, type Page } from '@playwright/test';

// Extra patience for token-picker flows — under full-suite load (cosmos-kit
// module init, multicall fallbacks, etc.) the default 5s locator timeouts
// occasionally aren't enough.
const MODAL_TIMEOUT = 30_000;

function tokenPickerModal(page: Page) {
  return page
    .locator('#headlessui-portal-root .token-picker-modal')
    .filter({ hasText: 'Select Token' });
}

async function waitForTokenPickerClosed(page: Page) {
  await expect(
    page.locator('#headlessui-portal-root [role="dialog"]').filter({ hasText: 'Select Token' }),
  ).toHaveCount(0, { timeout: MODAL_TIMEOUT });
}

async function selectTokenInVirtualList(modal: Locator, buttonName: RegExp) {
  const button = modal.getByRole('button', { name: buttonName });
  const scroller = modal.locator('.token-picker-scroll');

  await expect
    .poll(
      async () => {
        if (!(await modal.isVisible())) return true;

        if ((await button.count()) > 0) {
          try {
            await button.first().dispatchEvent('click', undefined, { timeout: 500 });
            return true;
          } catch {
            // Balance updates can reorder and unmount a row between lookup and click.
            // A successful selection also unmounts the modal before dispatchEvent settles.
            if (!(await modal.isVisible())) return true;
          }
        }

        await scroller.evaluate((element) => {
          const maxScrollTop = element.scrollHeight - element.clientHeight;
          const nextScrollTop = Math.min(
            maxScrollTop,
            element.scrollTop + element.clientHeight * 0.8,
          );
          element.scrollTop = nextScrollTop > element.scrollTop ? nextScrollTop : 0;
        });
        return false;
      },
      { intervals: [50], timeout: MODAL_TIMEOUT },
    )
    .toBe(true);
}

// In dev builds (`pnpm dev`) Next.js renders a <nextjs-portal> web
// component that intermittently shows up as the topmost element at
// picker button click points. Playwright's pointer-based click hit-tests
// report "<nextjs-portal></nextjs-portal> intercepts pointer events" and
// retry until timeout; a plain `force: true` click clears the
// intercept check but sometimes lands the pointer-up on the portal, so
// the React onClick never fires. Use `dispatchEvent('click')` instead —
// it synthesizes the click event directly on the target element via DOM
// API, bypassing hit-testing entirely. We always wait for the modal to
// be visible before the inner click, so the target is mounted and the
// click reaches the correct React handler. CI runs prod builds where
// the portal doesn't exist, so this is a no-op there.
export async function selectOriginToken(page: Page, buttonName: RegExp): Promise<void> {
  await page.getByTestId('token-select-origin').dispatchEvent('click');
  const modal = tokenPickerModal(page);
  await modal.waitFor({ state: 'visible', timeout: MODAL_TIMEOUT });
  await selectTokenInVirtualList(modal, buttonName);
  await waitForTokenPickerClosed(page);
}

export async function selectOriginTokenOnChain(
  page: Page,
  chainName: RegExp,
  buttonName: RegExp,
): Promise<void> {
  await page.getByTestId('token-select-origin').dispatchEvent('click');
  const modal = tokenPickerModal(page);
  await modal.waitFor({ state: 'visible', timeout: MODAL_TIMEOUT });
  await modal
    .getByRole('button', { name: chainName })
    .first()
    .dispatchEvent('click', undefined, { timeout: MODAL_TIMEOUT });
  await selectTokenInVirtualList(modal, buttonName);
  await waitForTokenPickerClosed(page);
}

export async function selectDestinationTokenOnChain(
  page: Page,
  chainName: RegExp,
  buttonName: RegExp,
): Promise<void> {
  await page.getByTestId('token-select-destination').dispatchEvent('click');
  const modal = tokenPickerModal(page);
  await modal.waitFor({ state: 'visible', timeout: MODAL_TIMEOUT });
  await modal
    .getByRole('button', { name: chainName })
    .first()
    .dispatchEvent('click', undefined, { timeout: MODAL_TIMEOUT });
  await selectTokenInVirtualList(modal, buttonName);
  await waitForTokenPickerClosed(page);
}

export async function selectDestinationToken(page: Page, buttonName: RegExp): Promise<void> {
  await page.getByTestId('token-select-destination').dispatchEvent('click');
  const modal = tokenPickerModal(page);
  await modal.waitFor({ state: 'visible', timeout: MODAL_TIMEOUT });
  await selectTokenInVirtualList(modal, buttonName);
  await waitForTokenPickerClosed(page);
}

export async function enterAmount(page: Page, amount: string): Promise<void> {
  const input = page.getByRole('spinbutton');
  await input.click();
  await input.fill(amount);
}

export async function clickContinue(page: Page): Promise<void> {
  // ButtonSection renders Continue in input mode, Send in review mode.
  await page.getByRole('button', { name: /^Continue$/ }).dispatchEvent('click');
}

export async function clickSendInReview(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Send to /i }).dispatchEvent('click');
}
