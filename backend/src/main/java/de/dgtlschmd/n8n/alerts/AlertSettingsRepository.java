package de.dgtlschmd.n8n.alerts;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AlertSettingsRepository extends JpaRepository<AlertSettings, Long> {
    Optional<AlertSettings> findByTenantId(String tenantId);
}

