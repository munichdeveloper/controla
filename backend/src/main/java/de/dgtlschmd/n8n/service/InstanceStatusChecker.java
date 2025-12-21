package de.dgtlschmd.n8n.service;

import de.dgtlschmd.n8n.instance.Instance;
import de.dgtlschmd.n8n.instance.InstanceRepository;
import de.dgtlschmd.n8n.instance.InstanceService;
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
        logger.info("Checking instance status...");
        List<Instance> instances = instanceRepository.findAll();

        for (Instance instance : instances) {
            try {
                instanceService.updateInstanceStatus(instance);
                instanceRepository.save(instance);
            } catch (Exception e) {
                logger.error("Error checking instance {}", instance.getName(), e);
            }
        }
    }
}