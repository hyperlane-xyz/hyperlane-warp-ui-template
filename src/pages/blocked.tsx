import { ErrorBoundary } from '../components/errors/ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary>
      {(() => {
        throw new Error('Geo blocked');
      })()}
    </ErrorBoundary>
  );
}
