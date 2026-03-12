import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { checkRelayStatus, RelayJobStatus } from '../../lib/relayerClient';
import { logger } from '../../utils/logger';
import { useStore } from '../store';
import { TransferStatus } from './types';

const RELAY_POLL_INTERVAL = 1000; // 1 second
const RELAY_MAX_ATTEMPTS = 300; // 5 minutes max

/**
 * Hook to poll relay job status and update transfer state
 */
export function useRelayStatusPoller() {
  const pollingJobs = useRef<Map<string, { attempts: number; toastId: string }>>(new Map());
  const { transfers } = useStore((s) => ({
    transfers: s.transfers,
  }));

  useEffect(() => {
    const activeRelays = transfers.filter(
      (t) => t.status === TransferStatus.Relaying && t.relayJobId,
    );

    console.log('[Relay Poller] Active relays:', activeRelays.length);
    console.log('[Relay Poller] Polling jobs:', pollingJobs.current.size);

    // Start polling for new relay jobs
    activeRelays.forEach((transfer) => {
      const jobId = transfer.relayJobId!;
      console.log('[Relay Poller] Checking job:', jobId);

      if (!pollingJobs.current.has(jobId)) {
        console.log('[Relay Poller] Starting new poll for job:', jobId);
        const toastId = toast.loading(
          `Relaying transfer to ${transfer.destination}...`,
          {
            autoClose: false,
          },
        ) as string;

        pollingJobs.current.set(jobId, { attempts: 0, toastId });
        pollRelayStatus(jobId, transfer.timestamp);
      } else {
        console.log('[Relay Poller] Job already being polled:', jobId);
      }
    });

    // Clean up completed jobs
    pollingJobs.current.forEach((_, jobId) => {
      const stillActive = activeRelays.some((t) => t.relayJobId === jobId);
      if (!stillActive) {
        pollingJobs.current.delete(jobId);
      }
    });
  }, [transfers]);

  const pollRelayStatus = async (jobId: string, transferIndex: number) => {
    const job = pollingJobs.current.get(jobId);
    if (!job) return;

    try {
      const statusResponse = await checkRelayStatus(jobId);
      console.log('=== Relay Status Update ===');
      console.log('Job ID:', jobId);
      console.log('Status:', statusResponse.status);
      console.log('Full response:', statusResponse);
      console.log('Attempt:', job.attempts, '/', RELAY_MAX_ATTEMPTS);
      console.log('========================');

      logger.debug('=== Relay Status Update ===');
      logger.debug('Job ID:', jobId);
      logger.debug('Status:', statusResponse.status);
      logger.debug('Full response:', JSON.stringify(statusResponse, null, 2));
      logger.debug('Attempt:', job.attempts, '/', RELAY_MAX_ATTEMPTS);
      logger.debug('========================');

      if (statusResponse.status === RelayJobStatus.Confirmed) {
        // Update transfer status to delivered
        useStore.getState().updateTransferStatus(transferIndex, TransferStatus.Delivered, {
          destTxHash: statusResponse.destination_tx_hash,
        });

        toast.update(job.toastId, {
          render: 'Transfer delivered!',
          type: 'success',
          isLoading: false,
          autoClose: 5000,
        });

        pollingJobs.current.delete(jobId);
        return;
      }

      if (statusResponse.status === RelayJobStatus.Failed) {
        toast.update(job.toastId, {
          render: `Relay failed: ${statusResponse.error || 'Unknown error'}`,
          type: 'error',
          isLoading: false,
          autoClose: 5000,
        });

        pollingJobs.current.delete(jobId);
        return;
      }

      // Continue polling if still in progress
      job.attempts++;

      if (job.attempts >= RELAY_MAX_ATTEMPTS) {
        toast.update(job.toastId, {
          render: 'Relay timed out. Please check manually.',
          type: 'warning',
          isLoading: false,
          autoClose: 5000,
        });

        pollingJobs.current.delete(jobId);
        return;
      }

      // Update toast message based on status
      const statusMessages: Record<RelayJobStatus, string> = {
        [RelayJobStatus.Pending]: 'Relay pending...',
        [RelayJobStatus.Extracting]: 'Extracting message...',
        [RelayJobStatus.Preparing]: 'Preparing relay...',
        [RelayJobStatus.Submitting]: 'Submitting to destination...',
        [RelayJobStatus.Submitted]: 'Waiting for confirmation...',
        [RelayJobStatus.Confirmed]: 'Confirmed',
        [RelayJobStatus.Failed]: 'Failed',
      };

      const message = statusMessages[statusResponse.status] || 'Relaying...';
      toast.update(job.toastId, {
        render: message,
      });

      // Schedule next poll
      setTimeout(() => pollRelayStatus(jobId, transferIndex), RELAY_POLL_INTERVAL);
    } catch (error: any) {
      logger.error('Error polling relay status:', error);

      // Retry on error (unless max attempts reached)
      job.attempts++;
      if (job.attempts < RELAY_MAX_ATTEMPTS) {
        setTimeout(() => pollRelayStatus(jobId, transferIndex), RELAY_POLL_INTERVAL);
      } else {
        toast.update(job.toastId, {
          render: 'Failed to check relay status',
          type: 'error',
          isLoading: false,
          autoClose: 5000,
        });

        pollingJobs.current.delete(jobId);
      }
    }
  };
}
