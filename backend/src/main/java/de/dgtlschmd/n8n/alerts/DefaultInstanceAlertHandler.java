package de.dgtlschmd.n8n.alerts;

import de.dgtlschmd.n8n.instance.Instance;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class DefaultInstanceAlertHandler implements InstanceAlertHandler {

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
    }

    @Override
    public void handleInstanceOffline(Instance instance) {
        alertSettingsRepository.findByTenantId(instance.getTenantId()).ifPresent(settings -> {
            if (settings.isEnabled() && settings.isNotifyOnInstanceOffline()) {
                sendEmail(settings.getEmail(), "n8n Instanz Offline: " + instance.getName(),
                        "Die n8n Instanz '" + instance.getName() + "' (" + instance.getBaseUrl() + ") ist nicht mehr erreichbar.");
            }
        });
    }

    @Override
    public void handleInstanceOnline(Instance instance) {
        alertSettingsRepository.findByTenantId(instance.getTenantId()).ifPresent(settings -> {
            if (settings.isEnabled() && settings.isNotifyOnInstanceOffline()) {
                sendEmail(settings.getEmail(), "n8n Instanz wieder Online: " + instance.getName(),
                        "Die n8n Instanz '" + instance.getName() + "' (" + instance.getBaseUrl() + ") ist wieder erreichbar.");
            }
        });
    }

    @Override
    public void handleWorkflowError(Instance instance, String workflowName, String errorMessage) {
        // CE implementation: Do nothing.
        // Premium implementation will override this.
    }

    private void sendEmail(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            emailSender.send(message);
        } catch (Exception e) {
            // Log error
            System.err.println("Failed to send email alert: " + e.getMessage());
        }
    }
}
