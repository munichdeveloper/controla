package de.atstck.controla.config;

import de.atstck.controla.security.CryptoService;
import de.atstck.controla.user.User;
import de.atstck.controla.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

@Configuration
@Slf4j
public class AdminUserInitializer {

    @Bean
    public CommandLineRunner initAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder, CryptoService cryptoService) {
        return args -> {
            log.info("=== AdminUserInitializer: Starting admin user initialization ===");

            if (userRepository.findByUsername("admin").isEmpty()) {
                log.info("=== AdminUserInitializer: Admin user does not exist, creating... ===");

                String password = UUID.randomUUID().toString().substring(0, 8);

                User admin = new User();
                admin.setUsername("admin");
                admin.setPassword(passwordEncoder.encode(password));
                admin.setEmail("admin@controla.local");
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
            } else {
                log.info("=== AdminUserInitializer: Admin user already exists, skipping creation ===");
            }
        };
    }
}

