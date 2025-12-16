package uk.ac.ic.wlgitbridge.auth;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

import java.io.IOException;
import java.lang.reflect.Type;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Lightweight client to call the internal web-profile API to retrieve user SSH keys.
 */
public class WebProfileClient {
    private final String baseUrl;
    private final String apiToken;
    private final Gson gson = new Gson();

    public WebProfileClient(String baseUrl, String apiToken) {
        this.baseUrl = baseUrl;
        this.apiToken = apiToken;
    }

    public Optional<String> getUserIdForFingerprint(String fingerprint) throws IOException {
        String url = String.format("%s/internal/api/ssh-keys/%s", baseUrl, URLEncoder.encode(fingerprint, StandardCharsets.UTF_8));
        try (CloseableHttpClient http = HttpClients.createDefault()) {
            HttpGet get = new HttpGet(url);
            if (apiToken != null && !apiToken.isEmpty()) {
                if (apiToken.contains(":")) {
                    String b64 = java.util.Base64.getEncoder().encodeToString(apiToken.getBytes(StandardCharsets.UTF_8));
                    get.addHeader("Authorization", "Basic " + b64);
                } else {
                    get.addHeader("Authorization", "Bearer " + apiToken);
                }
            }
            try (CloseableHttpResponse resp = http.execute(get)) {
                int status = resp.getStatusLine().getStatusCode();
                if (status >= 200 && status < 300) {
                    String json = EntityUtils.toString(resp.getEntity());
                    java.util.Map<String, Object> m = gson.fromJson(json, java.util.Map.class);
                    if (m != null && m.get("userId") != null) {
                        return Optional.of(String.valueOf(m.get("userId")));
                    }
                }
                return Optional.empty();
            }
        }
    }

    public List<SSHKey> getUserSSHKeys(String userId) throws IOException {
        // Call the internal users endpoint for SSH keys (contract expects /internal/api/users/...)
        String url = String.format("%s/internal/api/users/%s/ssh-keys", baseUrl.replaceAll("/$",""), userId);
        try (CloseableHttpClient http = HttpClients.createDefault()) {
            HttpGet get = new HttpGet(url);
            if (apiToken != null && !apiToken.isEmpty()) {
                if (apiToken.contains(":")) {
                    String b64 = java.util.Base64.getEncoder().encodeToString(apiToken.getBytes(StandardCharsets.UTF_8));
                    get.addHeader("Authorization", "Basic " + b64);
                } else {
                    get.addHeader("Authorization", "Bearer " + apiToken);
                }
            }
            try (CloseableHttpResponse resp = http.execute(get)) {
                int status = resp.getStatusLine().getStatusCode();
                if (status >= 200 && status < 300) {
                    String json = EntityUtils.toString(resp.getEntity());
                    // Avoid direct Gson deserialization into types containing java.time.Instant
                    // which may be inaccessible under strong encapsulation. Parse into a
                    // list of maps and convert to SSHKey manually (only core fields).
                    Type listMapType = new TypeToken<List<java.util.Map<String, Object>>>(){}.getType();
                    List<java.util.Map<String, Object>> raw = gson.fromJson(json, listMapType);
                    java.util.ArrayList<SSHKey> out = new java.util.ArrayList<>();
                    if (raw != null) {
                        for (java.util.Map<String, Object> m : raw) {
                            String id = m.get("id") != null ? String.valueOf(m.get("id")) : null;
                            String keyName = m.get("keyName") != null ? String.valueOf(m.get("keyName")) : null;
                            String publicKey = m.get("publicKey") != null ? String.valueOf(m.get("publicKey")) : null;
                            SSHKey k = new SSHKey(id, userId, keyName, publicKey);
                            out.add(k);
                        }
                    }
                    return out;
                }
                return Collections.emptyList();
            }
        }
    }

    /**
     * Introspect a token using the web-profile introspection endpoint.
     * Returns Optional.of(userId) when the token is active and contains a userId.
     */
    public static class TokenIntrospection {
        public final boolean active;
        public final java.util.Optional<String> userId;
        public final java.util.List<String> scopes;
        public final String expiresAt;

        public TokenIntrospection(boolean active, java.util.Optional<String> userId, java.util.List<String> scopes, String expiresAt) {
            this.active = active;
            this.userId = userId;
            this.scopes = scopes;
            this.expiresAt = expiresAt;
        }
    }

    public TokenIntrospection introspectToken(String token) throws IOException {
        String url = String.format("%s/internal/api/tokens/introspect", baseUrl);
        try (CloseableHttpClient http = HttpClients.createDefault()) {
            org.apache.http.client.methods.HttpPost post = new org.apache.http.client.methods.HttpPost(url);
            post.addHeader("Content-Type", "application/json");
            if (apiToken != null && !apiToken.isEmpty()) {
                if (apiToken.contains(":")) {
                    String b64 = java.util.Base64.getEncoder().encodeToString(apiToken.getBytes(StandardCharsets.UTF_8));
                    post.addHeader("Authorization", "Basic " + b64);
                } else {
                    post.addHeader("Authorization", "Bearer " + apiToken);
                }
            }
            String body = gson.toJson(java.util.Collections.singletonMap("token", token));
            post.setEntity(new org.apache.http.entity.StringEntity(body, StandardCharsets.UTF_8));
            try (CloseableHttpResponse resp = http.execute(post)) {
                int status = resp.getStatusLine().getStatusCode();
                if (status >= 200 && status < 300) {
                    String json = EntityUtils.toString(resp.getEntity());
                    java.util.Map<String, Object> m = gson.fromJson(json, java.util.Map.class);
                    boolean active = m != null && Boolean.TRUE.equals(m.get("active"));
                    java.util.Optional<String> uid = java.util.Optional.empty();
                    java.util.List<String> scopes = java.util.Collections.emptyList();
                    String expiresAt = null;
                    if (m != null) {
                        if (m.get("userId") != null) uid = java.util.Optional.of(String.valueOf(m.get("userId")));
                        if (m.get("scopes") instanceof java.util.List) {
                            scopes = (java.util.List<String>) m.get("scopes");
                        }
                        if (m.get("expiresAt") != null) expiresAt = String.valueOf(m.get("expiresAt"));
                    }
                    return new TokenIntrospection(active, uid, scopes, expiresAt);
                }
                return new TokenIntrospection(false, java.util.Optional.empty(), java.util.Collections.emptyList(), null);
            }
        }
    }
}
