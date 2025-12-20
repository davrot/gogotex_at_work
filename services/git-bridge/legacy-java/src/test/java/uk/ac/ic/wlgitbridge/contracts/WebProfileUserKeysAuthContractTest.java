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
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

public class WebProfileUserKeysAuthContractTest {
    private HttpServer server;
    private int port;
    private final AtomicReference<String> lastAuthHeader = new AtomicReference<>();

    @Before
    public void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        port = server.getAddress().getPort();

        server.createContext("/internal/api/service/users/user123/ssh-keys", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                lastAuthHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
                String body = "[{\"id\":\"k1\",\"userId\":\"user123\",\"keyName\":\"laptop\",\"publicKey\":\"ssh-rsa AAAAB3Nza...\"}]";
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
    public void getUserSSHKeys_sendsAuthorizationBearer() throws Exception {
        String baseUrl = "http://localhost:" + port;
        String token = "token-abc";
        WebProfileClient client = new WebProfileClient(baseUrl, token);

        List<SSHKey> keys = client.getUserSSHKeys("user123");

        Assert.assertNotNull(keys);
        Assert.assertEquals(1, keys.size());
        SSHKey k = keys.get(0);
        Assert.assertEquals("k1", k.getId());

        String auth = lastAuthHeader.get();
        Assert.assertNotNull("Authorization header was not received by server", auth);
        Assert.assertTrue("Authorization must be Bearer token", auth.startsWith("Bearer "));
        Assert.assertTrue(auth.endsWith(token));
    }
}
