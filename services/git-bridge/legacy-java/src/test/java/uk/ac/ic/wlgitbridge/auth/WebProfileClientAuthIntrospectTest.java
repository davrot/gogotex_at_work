package uk.ac.ic.wlgitbridge.auth;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.Assert;
import org.junit.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class WebProfileClientAuthIntrospectTest {

    @Test
    public void introspectToken_withBasicAuth_headerAccepted() throws Exception {
        final String expectedBasic = java.util.Base64.getEncoder().encodeToString("overleaf:overleaf".getBytes(StandardCharsets.UTF_8));
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/internal/api/tokens/introspect", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String auth = exchange.getRequestHeaders().getFirst("Authorization");
                if (auth == null || !auth.equals("Basic " + expectedBasic)) {
                    String resp = "{\"message\":\"Forbidden\"}";
                    exchange.getResponseHeaders().add("Content-Type", "application/json");
                    exchange.sendResponseHeaders(403, resp.getBytes().length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(resp.getBytes());
                    }
                    return;
                }

                String resp = "{\"active\":true,\"userId\":\"u123\",\"scopes\":[" + "\"read\"" + "],\"expiresAt\":\"2099-01-01T00:00:00Z\"}";
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, resp.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(resp.getBytes());
                }
            }
        });
        server.start();
        try {
            int port = server.getAddress().getPort();
            String baseUrl = "http://127.0.0.1:" + port;
            WebProfileClient client = new WebProfileClient(baseUrl, "overleaf:overleaf");
            WebProfileClient.TokenIntrospection ti = client.introspectToken("sometoken");
            Assert.assertTrue(ti.active);
            Assert.assertTrue(ti.userId.isPresent());
            Assert.assertEquals("u123", ti.userId.get());
            Assert.assertNotNull(ti.scopes);
            Assert.assertEquals(1, ti.scopes.size());
            Assert.assertEquals("read", ti.scopes.get(0));
            Assert.assertEquals("2099-01-01T00:00:00Z", ti.expiresAt);
        } finally {
            server.stop(0);
        }
    }
}
