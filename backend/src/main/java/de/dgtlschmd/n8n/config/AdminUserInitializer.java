package de.dgtlschmd.n8n.config;

import de.dgtlschmd.n8n.security.CryptoService;
import de.dgtlschmd.n8n.user.User;
import de.dgtlschmd.n8n.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

@Configuration
public class AdminUserInitializer {

    private static final Logger log = LoggerFactory.getLogger(AdminUserInitializer.class);

    @Bean
    public CommandLineRunner initAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder, CryptoService cryptoService) {
        return args -> {
            if (userRepository.findByUsername("admin").isEmpty()) {
                String password = UUID.randomUUID().toString().substring(0, 8);

                User admin = new User();
                admin.setUsername("admin");
                admin.setPassword(passwordEncoder.encode(password));
                admin.setEmail("admin@n8n-manager.local");
                admin.setRole("ADMIN");
                admin.setEnabled(true);
                admin.setTenantId(UUID.randomUUID().toString());
                admin.setSalt(cryptoService.generateSalt());

                userRepository.save(admin);

                log.info("\n\n");
                log.info("=================================================");
                log.info("Admin user created successfully.");
                log.info("Username: admin");
                log.info("Password: {}", password);
                log.info("=================================================");
                log.info("\n\n");
            }
        };
    }
}

