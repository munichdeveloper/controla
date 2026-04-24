'use client';

import { useState, useEffect, useRef } from 'react';
import { getCompanionStatus } from '@/lib/api';
import { CompanionStatus } from '@/lib/types';

export function useCompanionStatusPoller(externalId: string, enabled: boolean) {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdating = status?.updating ?? false;

  useEffect(() => {
    if (!enabled || !externalId) {
      return;
    }

    // Fetch initial status
    const fetchStatus = async () => {
      try {
        const data = await getCompanionStatus(externalId);
        setStatus(data);

        // Start polling only if updating
        if (data.updating) {
          setIsPolling(true);
        }
      } catch (error) {
        console.error('Failed to fetch companion status:', error);
      }
    };

    fetchStatus();

    if (isUpdating && !pollIntervalRef.current) {
      setIsPolling(true);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const data = await getCompanionStatus(externalId);
          setStatus(data);

          // Stop polling if update is done
          if (!data.updating) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsPolling(false);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000); // Poll every 3 seconds
    } else if (!isUpdating && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsPolling(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [externalId, enabled, isUpdating]);

  return { status, isPolling };
}

