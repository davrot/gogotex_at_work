package uk.ac.ic.wlgitbridge.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import uk.ac.ic.wlgitbridge.auth.WebProfileClient;

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
        return isKeyAuthorized(userId, presentedPublicKey, null, null);
    }

    /**
     * Extended version which supports an optional introspection fallback using
     * the provided WebProfileClient and token. If the fast-path fingerprint
     * lookup and direct key matching do not authorize the key, and a non-null
     * token + profileClient are provided, the token will be introspected and
     * if it maps to the same userId, authorization succeeds.
     */
    public boolean isKeyAuthorized(String userId, String presentedPublicKey, WebProfileClient profileClient, String token) {
        if (presentedPublicKey == null) return false;
        try {
            String normalizedPresented = normalizePublicKey(presentedPublicKey);
            String presentedFingerprint = fingerprint(normalizedPresented);
            // Fast path: try direct fingerprint->user lookup
            if (presentedFingerprint != null && !presentedFingerprint.isEmpty()) {
                try {
                    java.util.Optional<String> pf = profileClient.getUserIdForFingerprint("SHA256:" + presentedFingerprint);
                    if (pf != null && pf.isPresent() && Objects.equals(pf.get(), userId)) {
                        return true;
                    }
                } catch (Exception e) {
                    Log.debug("fingerprint lookup call failed: {}", e.getMessage());
                }
            }
            List<SSHKey> keys = profileClient.getUserSSHKeys(userId);
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

            // Introspection fallback: if token maps to the same userId, authorize
            if (token != null && profileClient != null) {
                try {
                    java.util.Optional<String> tokenUser = profileClient.introspectToken(token);
                    if (tokenUser != null && tokenUser.isPresent() && Objects.equals(tokenUser.get(), userId)) {
                        Log.debug("Introspection fallback authorized user {}", userId);
                        return true;
                    }
                } catch (Exception e) {
                    Log.debug("token introspection call failed: {}", e.getMessage());
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
