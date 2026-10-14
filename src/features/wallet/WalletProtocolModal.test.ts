import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, it } from 'vitest';

import { config } from '../../consts/config';
import { PROTOCOL_OPTIONS } from './WalletProtocolModal';

describe('WalletProtocolModal', () => {
  it('includes tron in the modal options when tron is enabled in config', () => {
    expect(config.walletProtocols).toContain(ProtocolType.Tron);
    expect(PROTOCOL_OPTIONS.map((option) => option.protocol)).toContain(ProtocolType.Tron);
  });
});
