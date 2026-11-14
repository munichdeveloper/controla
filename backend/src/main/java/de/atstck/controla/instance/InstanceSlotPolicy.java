package de.atstck.controla.instance;

import java.time.Duration;

/** Editions may supply a tenant-specific reservation period. */
@FunctionalInterface
public interface InstanceSlotPolicy {
    Duration archiveSlotLock(String tenantId);
}
