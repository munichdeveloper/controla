package de.atstck.controla.service;

import de.atstck.controla.instance.Instance;
import de.atstck.controla.instance.InstanceRepository;
import de.atstck.controla.instance.InstanceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InstanceStatusChecker {

    private static final Logger logger = LoggerFactory.getLogger(InstanceStatusChecker.class);

    private final InstanceRepository instanceRepository;
    private final InstanceService instanceService;

    public InstanceStatusChecker(InstanceRepository instanceRepository,
                                 InstanceService instanceService) {
        this.instanceRepository = instanceRepository;
        this.instanceService = instanceService;
    }

    @Scheduled(fixedRateString = "${n8n.monitor.interval-ms:60000}")
    public void checkInstances() {
        long startNanos = System.nanoTime();
        logger.info("Checking instance status... (scheduler run started)");
        List<Instance> instances = instanceRepository.findAll();
        logger.info("Scheduler fetched {} instance(s) for status check", instances.size());

        int successCount = 0;
        int errorCount = 0;

        for (Instance instance : instances) {
            try {
                logger.debug("Starting instance status update: tenantId={}, instanceId={}, instanceName={}, currentStatus={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), instance.getStatus());
                instanceService.updateInstanceStatus(instance);
                instanceRepository.save(instance);
                logger.debug("Finished instance status update: tenantId={}, instanceId={}, instanceName={}, resultingStatus={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), instance.getStatus());
                successCount++;
            } catch (Exception e) {
                errorCount++;
                logger.error("Error checking instance: tenantId={}, instanceId={}, instanceName={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), e);
            }
        }

        long durationMs = (System.nanoTime() - startNanos) / 1_000_000;
        logger.info("Scheduler run finished: totalInstances={}, successful={}, failed={}, durationMs={}",
                instances.size(), successCount, errorCount, durationMs);
    }
}
