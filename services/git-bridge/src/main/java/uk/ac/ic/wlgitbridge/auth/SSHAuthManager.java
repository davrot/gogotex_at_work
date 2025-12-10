package uk.ac.ic.wlgitbridge.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Objects;

/**
 * Manager that validates whether a presented public key is authorized for a user.
 */
public class SSHAuthManager {
    private static final Logger Log = LoggerFactory.getLogger(SSHAuthManager.class);
    private final WebProfileClient profileClient;

    public SSHAuthManager(WebProfileClient profileClient) {
        this.profileClient = profileClient;
    }

    public boolean isKeyAuthorized(String userId, String presentedPublicKey) {
        if (presentedPublicKey == null) return false;
        try {
            List<SSHKey> keys = profileClient.getUserSSHKeys(userId);
            String normalizedPresented = normalizePublicKey(presentedPublicKey);
            String presentedFingerprint = fingerprint(normalizedPresented);
            for (SSHKey k : keys) {
                if (k == null || k.getPublicKey() == null) continue;
                String stored = normalizePublicKey(k.getPublicKey());
                if (Objects.equals(stored, normalizedPresented)) {
                    System.out.println("Exact match for key: " + stored);
                    return true;
                }
                String storedFp = fingerprint(stored);
                if (!storedFp.isEmpty() && !presentedFingerprint.isEmpty() && Objects.equals(storedFp, presentedFingerprint)) {
                    System.out.println("Fingerprint match for user " + userId + ": storedFp=" + storedFp + " presentedFp=" + presentedFingerprint);
                    return true;
                }
            }
        } catch (Exception e) {
            Log.warn("Error validating SSH key for user {}: {}", userId, e.getMessage());
            return false;
        }
        return false;
    }

    private static String normalizePublicKey(String pubkey) {
        String s = pubkey.trim().replaceAll("\\s+", " ");
        String[] parts = s.split(" ", 3);
        if (parts.length >= 2) {
            return parts[0] + " " + parts[1];
        }
        return s;
    }

    private static String fingerprint(String pubkey) {
        try {
            // pubkey format: <type> <base64> [comment]
            String[] parts = pubkey.split(" ", 3);
            if (parts.length < 2) return "";
            byte[] keyBytes = Base64.getDecoder().decode(parts[1].getBytes(StandardCharsets.UTF_8));
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest(keyBytes);
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            return "";
        }
    }
}
