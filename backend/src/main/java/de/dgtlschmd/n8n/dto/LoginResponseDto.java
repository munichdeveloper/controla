package de.dgtlschmd.n8n.dto;

/**
 * DTO für Login-Antwort mit JWT-Token
 */
public class LoginResponseDto {
    private String token;
    private String username;
    private String email;
    private String role;

    public LoginResponseDto() {
    }

    public LoginResponseDto(String token, String username, String email, String role) {
        this.token = token;
        this.username = username;
        this.email = email;
        this.role = role;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}

