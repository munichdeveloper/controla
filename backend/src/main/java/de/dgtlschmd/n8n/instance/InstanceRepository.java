package de.dgtlschmd.n8n.instance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstanceRepository extends JpaRepository<Instance, Long> {
    List<Instance> findByTenantId(String tenantId);

    Optional<Instance> findByIdAndTenantId(Long id, String tenantId);

    Optional<Instance> findByExternalIdAndTenantId(String externalId, String tenantId);

    long countByTenantId(String tenantId);
}