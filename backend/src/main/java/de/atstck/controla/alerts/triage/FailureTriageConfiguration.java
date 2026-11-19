package de.atstck.controla.alerts.triage;

import de.atstck.controla.service.N8nApiClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "controla.triage.enabled", havingValue = "true")
public class FailureTriageConfiguration {
    @Bean
    @ConditionalOnMissingBean(FailureTriageClassifier.class)
    public FailureTriageClassifier failureTriageClassifier(
            @Value("${controla.triage.provider:rules}") String provider,
            @Value("${controla.triage.jev.api-key:}") String apiKey,
            @Value("${controla.triage.jev.model:jev-latest}") String model,
            @Value("${controla.triage.jev.timeout-ms:5000}") long timeoutMs) {
        return switch (provider) {
            case "rules" -> new RuleBasedFailureTriageClassifier();
            case "jev" -> apiKey.isBlank()
                    ? signal -> TriageDecision.unsure("provider_not_configured")
                    : new JevFailureTriageClassifier(apiKey, model, timeoutMs);
            default -> throw new IllegalArgumentException("Unsupported controla.triage.provider");
        };
    }

    @Bean
    public FailureTriageObserver failureTriageObserver(FailureTriageClassifier classifier, N8nApiClient client) {
        return new FailureTriageObserver(classifier, client);
    }
}
