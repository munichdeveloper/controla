package de.atstck.controla.alerts;

import de.atstck.controla.instance.Instance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class DefaultInstanceAlertHandler implements InstanceAlertHandler {

    private static final Logger logger = LoggerFactory.getLogger(DefaultInstanceAlertHandler.class);

    private final AlertSettingsRepository alertSettingsRepository;
    private final JavaMailSender emailSender;

    public DefaultInstanceAlertHandler(AlertSettingsRepository alertSettingsRepository, JavaMailSender emailSender) {
        this.alertSettingsRepository = alertSettingsRepository;
        this.emailSender = emailSender;
    }

    @Override
    public void handleInvalidApiKey(Instance instance) {
        // CE implementation: Do nothing or maybe log it.
        // Premium implementation will override this.
        logger.info("Invalid API key detected (CE no-op handler): tenantId={}, instanceId={}, instanceName={}",
                instance.getTenantId(), instance.getExternalId(), instance.getName());
    }

    @Override
    public void handleInstanceOffline(Instance instance) {
        logger.info("Evaluating offline alert: tenantId={}, instanceId={}, instanceName={}",
                instance.getTenantId(), instance.getExternalId(), instance.getName());
        var settingsOptional = alertSettingsRepository.findByTenantId(instance.getTenantId());
        settingsOptional.ifPresent(settings -> {
            if (settings.isEnabled() && settings.isNotifyOnInstanceOffline()) {
                logger.info("Offline alert enabled, sending email: tenantId={}, instanceId={}, instanceName={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName());
                sendEmail(settings.getEmail(), "n8n Instanz Offline: " + instance.getName(),
                        "Die n8n Instanz '" + instance.getName() + "' (" + instance.getBaseUrl() + ") ist nicht mehr erreichbar.");
            } else {
                logger.debug("Offline alert skipped by settings: tenantId={}, instanceId={}, instanceName={}, enabled={}, notifyOnInstanceOffline={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), settings.isEnabled(), settings.isNotifyOnInstanceOffline());
            }
        });
        if (settingsOptional.isEmpty()) {
            logger.debug("Offline alert skipped: no alert settings found for tenantId={}", instance.getTenantId());
        }
    }

    @Override
    public void handleInstanceOnline(Instance instance) {
        logger.info("Evaluating online alert: tenantId={}, instanceId={}, instanceName={}",
                instance.getTenantId(), instance.getExternalId(), instance.getName());
        var settingsOptional = alertSettingsRepository.findByTenantId(instance.getTenantId());
        settingsOptional.ifPresent(settings -> {
            if (settings.isEnabled() && settings.isNotifyOnInstanceOffline()) {
                logger.info("Online alert enabled, sending email: tenantId={}, instanceId={}, instanceName={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName());
                sendEmail(settings.getEmail(), "n8n Instanz wieder Online: " + instance.getName(),
                        "Die n8n Instanz '" + instance.getName() + "' (" + instance.getBaseUrl() + ") ist wieder erreichbar.");
            } else {
                logger.debug("Online alert skipped by settings: tenantId={}, instanceId={}, instanceName={}, enabled={}, notifyOnInstanceOffline={}",
                        instance.getTenantId(), instance.getExternalId(), instance.getName(), settings.isEnabled(), settings.isNotifyOnInstanceOffline());
            }
        });
        if (settingsOptional.isEmpty()) {
            logger.debug("Online alert skipped: no alert settings found for tenantId={}", instance.getTenantId());
        }
    }

    @Override
    public void handleWorkflowError(Instance instance, String workflowName, String errorMessage) {
        // CE implementation: Do nothing.
        // Premium implementation will override this.
        logger.info("Workflow error received (CE no-op handler): tenantId={}, instanceId={}, instanceName={}, workflowName={}",
                instance.getTenantId(), instance.getExternalId(), instance.getName(), workflowName);
    }

    private void sendEmail(String to, String subject, String text) {
        try {
            logger.debug("Sending instance alert email: subject='{}'", subject);
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            emailSender.send(message);
            logger.info("Instance alert email sent successfully: subject='{}'", subject);
        } catch (Exception e) {
            logger.error("Failed to send instance alert email: subject='{}'", subject, e);
        }
    }
}
