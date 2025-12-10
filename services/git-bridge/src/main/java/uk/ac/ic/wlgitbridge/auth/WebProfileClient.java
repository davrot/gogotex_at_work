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
import java.util.Collections;
import java.util.List;

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

    public List<SSHKey> getUserSSHKeys(String userId) throws IOException {
        String url = String.format("%s/internal/api/users/%s/ssh-keys", baseUrl, userId);
        try (CloseableHttpClient http = HttpClients.createDefault()) {
            HttpGet get = new HttpGet(url);
            if (apiToken != null && !apiToken.isEmpty()) {
                get.addHeader("Authorization", "Bearer " + apiToken);
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
}
