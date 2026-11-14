package de.atstck.controla.instance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.time.Instant;

public interface InstanceRepository extends JpaRepository<Instance, Long> {
    List<Instance> findByTenantId(String tenantId);

    Optional<Instance> findByIdAndTenantId(Long id, String tenantId);

    Optional<Instance> findByExternalIdAndTenantId(String externalId, String tenantId);

    long countByTenantId(String tenantId);

    List<Instance> findByArchivedAtIsNull();

    long countByTenantIdAndArchivedAtLessThanEqual(String tenantId, Instant cutoff);

    @Query("select count(l) from InstanceSlotLock l where l.tenantId = :tenantId and l.deletedAt > :cutoff")
    long countReservedDeletedSlots(@Param("tenantId") String tenantId, @Param("cutoff") Instant cutoff);

    @Query("select max(l.deletedAt) from InstanceSlotLock l where l.tenantId = :tenantId and l.baseUrl = :baseUrl")
    Optional<Instant> latestSlotDeletion(@Param("tenantId") String tenantId, @Param("baseUrl") String baseUrl);

    List<Instance> findByTenantIdAndArchivedAtIsNotNull(String tenantId);

    @Modifying
    @Query(value = "INSERT INTO instance_slot_locks(tenant_id, base_url, deleted_at) VALUES (:tenantId, :baseUrl, :deletedAt)", nativeQuery = true)
    void reserveDeletedSlot(@Param("tenantId") String tenantId, @Param("baseUrl") String baseUrl,
                            @Param("deletedAt") Instant deletedAt);

    @Query("select distinct l.tenantId from InstanceSlotLock l")
    List<String> tenantsWithSlotLocks();

    @Modifying
    @Query("delete from InstanceSlotLock l where l.tenantId = :tenantId and l.deletedAt <= :cutoff")
    void deleteExpiredSlotLocks(@Param("tenantId") String tenantId, @Param("cutoff") Instant cutoff);

    /**
     * Lock instance creation for this tenant until the enclosing transaction ends.
     * The first key reserves an advisory-lock namespace for instance admission.
     * A tenant hash collision only serializes unrelated tenants; it cannot bypass the limit.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(1129270868, hashtext(:tenantId))", nativeQuery = true)
    int lockInstanceCreation(@Param("tenantId") String tenantId);
}
