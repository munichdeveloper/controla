package de.atstck.controla.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.*;
import java.util.Properties;
import static org.assertj.core.api.Assertions.*;

class RequiredSecretConfigurationTest {
    @Test
    void productionSecretsHaveNoFallbackAndMissingValuesFailResolution() throws Exception {
        Properties properties = new Properties();
        try (var input = getClass().getResourceAsStream("/application.properties")) {
            properties.load(input);
        }
        var environment = new org.springframework.mock.env.MockEnvironment();
        environment.getPropertySources().addFirst(new PropertiesPropertySource("production", properties));
        for (String key : new String[]{"jwt.secret","core.api-token","spring.datasource.password","controla.security.master-key"}) {
            String placeholder = properties.getProperty(key);
            assertThat(placeholder).matches("\\$\\{[A-Z_]+}");
            assertThatThrownBy(() -> environment.getRequiredProperty(key))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
