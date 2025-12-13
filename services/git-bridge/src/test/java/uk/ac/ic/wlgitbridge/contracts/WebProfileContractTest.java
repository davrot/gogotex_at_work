package uk.ac.ic.wlgitbridge.contracts;

import com.google.gson.Gson;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.auth.SSHKey;
import uk.ac.ic.wlgitbridge.auth.WebProfileClient;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

public class WebProfileContractTest {
    private HttpServer server;
    private int port;
    private final AtomicReference<String> lastAuthHeader = new AtomicReference<>();
    private final Gson gson = new Gson();

    @Before
    public void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        port = server.getAddress().getPort();
        server.createContext("/internal/api/users/user123/ssh-keys", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                lastAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
                // Emit a simple JSON array literal to avoid Gson/Instant serialization issues
                String body = "[{\"id\":\"k1\",\"userId\":\"user123\",\"keyName\":\"laptop\",\"publicKey\":\"ssh-rsa AAAAB3Nza...\"}]";
                byte[] bytes = body.getBytes();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });
        server.createContext("/internal/api/ssh-keys/SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String body = "{\"userId\":\"user123\"}";
                byte[] bytes = body.getBytes();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });
        server.start();
        // brief pause to ensure the server socket is fully ready before the client connects
        try { Thread.sleep(100); } catch (InterruptedException ignored) {}
    }

    @After
    public void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    public void getUserSSHKeys_returnsKeys_and_sendsAuthHeader() throws Exception {
        String baseUrl = "http://localhost:" + port;
        String token = "s3cr3t-token";
        WebProfileClient client = new WebProfileClient(baseUrl, token);

        List<SSHKey> keys = client.getUserSSHKeys("user123");

        Assert.assertNotNull(keys);
        Assert.assertEquals(1, keys.size());
        SSHKey k = keys.get(0);
        Assert.assertEquals("k1", k.getId());

        // Verify Authorization header was sent
        String auth = lastAuthHeader.get();
        Assert.assertNotNull("Authorization header was not received by server", auth);
        Assert.assertTrue("Authorization must be Bearer token", auth.startsWith("Bearer "));
        Assert.assertTrue(auth.endsWith(token));

        // Verify fingerprint lookup returns the expected userId
        java.util.Optional<String> uid = client.getUserIdForFingerprint("SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        Assert.assertTrue(uid.isPresent());
        Assert.assertEquals("user123", uid.get());

        // 401: unauthorised when no token provided
        HttpGet get401 = new HttpGet(baseUrl + "/internal/api/ssh-keys/SHA256:unauth");
        // We set up a server context that returns 401 if no Authorization header present
        server.createContext("/internal/api/ssh-keys/SHA256:unauth", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
                if (authHeader == null) {
                    exchange.sendResponseHeaders(401, -1);
                    return;
                }
                String body = "{\"userId\":\"user123\"}";
                byte[] bytes = body.getBytes();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });
        WebProfileClient noAuthClient = new WebProfileClient(baseUrl, null);
        java.util.Optional<String> emptyUid = noAuthClient.getUserIdForFingerprint("SHA256:unauth");
        Assert.assertFalse(emptyUid.isPresent());

        // 429: rate-limited
        server.createContext("/internal/api/ssh-keys/SHA256:ratelimit", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                exchange.sendResponseHeaders(429, -1);
            }
        });
        java.util.Optional<String> rlUid = client.getUserIdForFingerprint("SHA256:ratelimit");
        Assert.assertFalse(rlUid.isPresent());
    }
}
