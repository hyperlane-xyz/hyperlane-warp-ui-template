import { ErrorBoundary } from '../components/errors/ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary>
      {(() => {
        throw new Error('Your region has been blocked from accessing this service');
      })()}
    </ErrorBoundary>
  );
}
