import { WideChevron as WideChevronInner } from '@hyperlane-xyz/widgets';

import { Color } from '../../styles/Color';

export function WideChevron({ className }: { className?: string }) {
  return (
    <WideChevronInner
      width="16"
      height="100%"
      direction="e"
      color={Color.lightGray}
      className={className}
      rounded={true}
    />
  );
}
