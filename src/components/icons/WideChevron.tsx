import { WideChevronIcon } from '@hyperlane-xyz/widgets';
import { Color } from '../../styles/Color';

export function WideChevron({ className }: { className?: string }) {
  return (
    <WideChevronIcon
      width="16"
      height="100%"
      direction="e"
      color={Color.lightGray}
      className={className}
      rounded={true}
    />
  );
}
