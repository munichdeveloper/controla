package de.atstck.controla.instance;

import jakarta.persistence.*;
import java.time.Instant;

/** Temporary reservation, intentionally without a foreign key to the deleted instance. */
@Entity
@Table(name = "instance_slot_locks")
public class InstanceSlotLock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "base_url", nullable = false, length = 512)
    private String baseUrl;
    @Column(name = "deleted_at", nullable = false)
    private Instant deletedAt;
}
