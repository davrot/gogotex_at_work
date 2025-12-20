package uk.ac.ic.wlgitbridge.auth;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;

public class SSHAuthManagerIntegrationTest {
    private HttpServer server;
    private int port;

    @Before
    public void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        port = server.getAddress().getPort();

        // Fingerprint lookup stub: return a userId for any fingerprint
        server.createContext("/internal/api/ssh-keys", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String path = exchange.getRequestURI().getPath();
                // Only handle fingerprint path
                if (!path.startsWith("/internal/api/ssh-keys/")) {
                    exchange.sendResponseHeaders(404, -1);
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

        server.start();
        try { Thread.sleep(50); } catch (InterruptedException ignored) {}
    }

    @After
    public void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    public void fingerprintLookup_allowsAuthManagerFastPath() throws Exception {
        String baseUrl = "http://localhost:" + port;
        WebProfileClient client = new WebProfileClient(baseUrl, null);
        SSHAuthManager authManager = new SSHAuthManager(client);

        // A valid-looking public key (content not important as the HTTP stub responds to any fingerprint)
        String presentedPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCfakebase64key data@example.com";

        boolean authorized = authManager.isKeyAuthorized("user123", presentedPublicKey);
        Assert.assertTrue("Auth manager should authorize when fingerprint lookup returns the user", authorized);
    }
}
