package de.atstck.controla.instance;

import java.time.Instant;

public class InstanceSlotLockedException extends IllegalStateException {
    private final Instant availableAt;

    public InstanceSlotLockedException(Instant availableAt) {
        super("Der Instanzplatz für diese URL ist vorübergehend gesperrt.");
        this.availableAt = availableAt;
    }

    public Instant getAvailableAt() { return availableAt; }
}
