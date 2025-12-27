package de.dgtlschmd.n8n.auth;

import de.dgtlschmd.n8n.dto.LoginRequestDto;
import de.dgtlschmd.n8n.dto.LoginResponseDto;
import de.dgtlschmd.n8n.dto.RegisterRequestDto;
import de.dgtlschmd.n8n.security.CustomUserDetailsService;
import de.dgtlschmd.n8n.security.JwtUtil;
import de.dgtlschmd.n8n.security.CryptoService;
import de.dgtlschmd.n8n.security.UserKeyCache;
import de.dgtlschmd.n8n.user.User;
import de.dgtlschmd.n8n.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;

import javax.crypto.SecretKey;
import java.util.UUID;

/**
 * Controller für Authentifizierung (Login, Registrierung)
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@ConditionalOnMissingBean(AuthController.class)
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authenticationManager;
    private final CustomUserDetailsService userDetailsService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CryptoService cryptoService;
    private final UserKeyCache userKeyCache;

    public AuthController(
            AuthenticationManager authenticationManager,
            CustomUserDetailsService userDetailsService,
            JwtUtil jwtUtil,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CryptoService cryptoService,
            UserKeyCache userKeyCache) {
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.cryptoService = cryptoService;
        this.userKeyCache = userKeyCache;
    }

    /**
     * POST /api/auth/login
     * Login mit Username und Passwort
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDto request) {
        log.info("Login attempt for user: {}", request.getUsername());

        try {
            // Authenticate user
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );

            log.info("Authentication successful for user: {}", request.getUsername());

            final UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
            final String jwt = jwtUtil.generateToken(userDetails);

            User user = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Derive key from password and salt, and cache it
            if (user.getSalt() != null) {
                SecretKey key = cryptoService.deriveKey(request.getPassword(), user.getSalt());
                userKeyCache.putKey(user.getTenantId(), key);
            } else {
                log.warn("User {} has no salt, skipping key derivation", user.getUsername());
            }

            LoginResponseDto response = new LoginResponseDto(
                    jwt,
                    user.getUsername(),
                    user.getEmail(),
                    user.getRole()
            );

            log.info("Login successful for user: {}", request.getUsername());
            return ResponseEntity.ok(response);

        } catch (BadCredentialsException e) {
            log.warn("Bad credentials for user: {}", request.getUsername());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Ungültige Anmeldedaten");
        } catch (Exception e) {
            log.error("Login failed for user: {}", request.getUsername(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Login fehlgeschlagen: " + e.getMessage());
        }
    }

    /**
     * POST /api/auth/register
     * Registrierung eines neuen Benutzers
     */
    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> register(@RequestBody RegisterRequestDto request) {
        try {
            // Prüfen ob Username bereits existiert
            if (userRepository.existsByUsername(request.getUsername())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Username bereits vergeben");
            }

            // Prüfen ob Email bereits existiert
            if (userRepository.existsByEmail(request.getEmail())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body("Email bereits vergeben");
            }

            User user = new User();
            user.setUsername(request.getUsername());
            user.setPassword(passwordEncoder.encode(request.getPassword()));
            user.setEmail(request.getEmail());
            user.setRole("USER");
            user.setEnabled(true);

            // Generate Salt
            String salt = cryptoService.generateSalt();
            user.setSalt(salt);

            // Assign a new unique tenant ID for the new user
            user.setTenantId(UUID.randomUUID().toString());

            userRepository.save(user);

            return ResponseEntity.status(HttpStatus.CREATED).body("Benutzer erfolgreich registriert");
        } catch (Exception e) {
            log.error("Registration failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Registrierung fehlgeschlagen: " + e.getMessage());
        }
    }

    /**
     * GET /api/auth/me
     * Gibt die Informationen des aktuell eingeloggten Benutzers zurück
     */
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader("Authorization") String authHeader) {
        try {
            String jwt = authHeader.substring(7);
            String username = jwtUtil.extractUsername(jwt);

            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            LoginResponseDto response = new LoginResponseDto(
                    null, // Token nicht erneut senden
                    user.getUsername(),
                    user.getEmail(),
                    user.getRole()
            );

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Nicht authentifiziert");
        }
    }
}
