package de.dgtlschmd.n8n.auth;

import de.dgtlschmd.n8n.user.User;
import de.dgtlschmd.n8n.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * DEBUG CONTROLLER - NUR FÜR ENTWICKLUNG!
 * Entfernen vor Production Deployment
 */
@RestController
@RequestMapping("/api/debug")
@CrossOrigin(origins = "*")
public class DebugController {

    private static final Logger log = LoggerFactory.getLogger(DebugController.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DebugController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * GET /api/debug/user/{username}
     * Zeigt User-Informationen (OHNE Passwort)
     */
    @GetMapping("/user/{username}")
    public ResponseEntity<?> getUser(@PathVariable String username) {
        log.info("Debug: Fetching user {}", username);

        User user = userRepository.findByUsername(username)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("role", user.getRole());
        result.put("enabled", user.isEnabled());
        result.put("passwordHashPrefix", user.getPassword().substring(0, 20) + "...");
        result.put("createdAt", user.getCreatedAt());
        result.put("updatedAt", user.getUpdatedAt());

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/debug/verify-password
     * Überprüft ob ein Passwort zum Hash passt
     */
    @PostMapping("/verify-password")
    public ResponseEntity<?> verifyPassword(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String plainPassword = request.get("password");

        log.info("Debug: Verifying password for user {}", username);

        User user = userRepository.findByUsername(username)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        boolean matches = passwordEncoder.matches(plainPassword, user.getPassword());

        Map<String, Object> result = new HashMap<>();
        result.put("username", username);
        result.put("passwordMatches", matches);
        result.put("passwordHashPrefix", user.getPassword().substring(0, 20) + "...");
        result.put("enabled", user.isEnabled());
        result.put("role", user.getRole());

        log.info("Password verification for {}: {}", username, matches);

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/debug/generate-hash
     * Generiert einen BCrypt Hash für ein Passwort
     */
    @PostMapping("/generate-hash")
    public ResponseEntity<?> generateHash(@RequestBody Map<String, String> request) {
        String plainPassword = request.get("password");

        String hash = passwordEncoder.encode(plainPassword);

        Map<String, Object> result = new HashMap<>();
        result.put("plainPassword", plainPassword);
        result.put("hash", hash);
        result.put("algorithm", "BCrypt");

        return ResponseEntity.ok(result);
    }
}

