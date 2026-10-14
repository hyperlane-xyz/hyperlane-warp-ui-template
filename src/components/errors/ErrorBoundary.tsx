import { ErrorBoundary as ErrorBoundaryInner } from '@hyperlane-xyz/widgets';
import { PropsWithChildren } from 'react';

import { links } from '../../consts/links';

export function ErrorBoundary({ children }: PropsWithChildren<unknown>) {
  return <ErrorBoundaryInner supportLink={<SupportLink />}>{children}</ErrorBoundaryInner>;
}

function SupportLink() {
  return (
    <a href={links.support} target="_blank" rel="noopener noreferrer" className="mt-5 text-sm">
      For support, visit the{' '}
      <span className="underline underline-offset-2">Hyperlane Help Center</span>{' '}
    </a>
  );
}
