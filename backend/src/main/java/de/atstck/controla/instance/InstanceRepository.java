package de.atstck.controla.instance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface InstanceRepository extends JpaRepository<Instance, Long> {
    List<Instance> findByTenantId(String tenantId);

    Optional<Instance> findByIdAndTenantId(Long id, String tenantId);

    Optional<Instance> findByExternalIdAndTenantId(String externalId, String tenantId);

    long countByTenantId(String tenantId);

    /**
     * Lock instance creation for this tenant until the enclosing transaction ends.
     * The first key reserves an advisory-lock namespace for instance admission.
     * A tenant hash collision only serializes unrelated tenants; it cannot bypass the limit.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(1129270868, hashtext(:tenantId))", nativeQuery = true)
    int lockInstanceCreation(@Param("tenantId") String tenantId);
}
