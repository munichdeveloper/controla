package de.atstck.controla.passwordreset;

import de.atstck.controla.service.EmailService;
import de.atstck.controla.user.User;
import de.atstck.controla.user.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@Slf4j
public class PasswordResetServiceImpl implements PasswordResetService {

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.password-reset.token-validity-hours:24}")
    private int tokenValidityHours;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendAppUrl;

    public PasswordResetServiceImpl(
            PasswordResetTokenRepository tokenRepository,
            UserRepository userRepository,
            EmailService emailService,
            PasswordEncoder passwordEncoder) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Erstellt einen Password-Reset-Token und sendet eine E-Mail
     * Wichtig: Gibt immer eine erfolgreiche Antwort zurück (Timing-Attack-Schutz)
     */
    @Override
    @Transactional
    public void requestPasswordReset(String email) {
        try {
            // Simuliere eine kleine Verzögerung für Timing-Attack-Schutz
            Thread.sleep(500);

            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                log.info("Password reset requested for non-existent email: {}", email);
                return; // Keine Fehlermeldung, um E-Mail-Enumeration zu verhindern
            }

            // Lösche alte Tokens für diesen User
            tokenRepository.deleteByUserId(user.getId());

            // Erstelle neuen Token
            String token = UUID.randomUUID().toString();
            LocalDateTime expiryDate = LocalDateTime.now().plusHours(tokenValidityHours);

            PasswordResetToken resetToken = new PasswordResetToken(token, user, expiryDate);
            tokenRepository.save(resetToken);

            // Erstelle Reset-URL
            String resetUrl = frontendAppUrl + "/reset-password?token=" + token;

            // Sende E-Mail
            emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), resetUrl);

            log.info("Password reset token created for user: {}", user.getUsername());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Interrupted during password reset request", e);
        } catch (Exception e) {
            log.error("Error during password reset request", e);
            // Schlucke den Fehler, um keine Informationen preiszugeben
        }
    }

    /**
     * Setzt das Passwort zurück
     */
    @Override
    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Ungültiger oder abgelaufener Token"));

        if (!resetToken.isValid()) {
            throw new IllegalArgumentException("Token ist ungültig oder bereits verwendet");
        }

        User user = resetToken.getUser();

        // Aktualisiere Passwort
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Markiere Token als verwendet
        resetToken.setUsed(true);
        tokenRepository.save(resetToken);

        log.info("Password successfully reset for user: {}", user.getUsername());
    }

    /**
     * Validiert einen Token (für Frontend-Check)
     */
    @Override
    public boolean isTokenValid(String token) {
        return tokenRepository.findByToken(token)
                .map(PasswordResetToken::isValid)
                .orElse(false);
    }

    /**
     * Löscht alte, abgelaufene Tokens (läuft täglich um 3 Uhr)
     */
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanupExpiredTokens() {
        tokenRepository.deleteByExpiryDateBefore(LocalDateTime.now());
        log.info("Cleaned up expired password reset tokens");
    }
}
