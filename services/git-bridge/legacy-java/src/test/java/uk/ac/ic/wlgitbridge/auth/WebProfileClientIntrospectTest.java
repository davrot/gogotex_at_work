package uk.ac.ic.wlgitbridge.auth;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.Assert;
import org.junit.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.Optional;

public class WebProfileClientIntrospectTest {
    @Test
    public void introspectToken_returnsUserId_whenActive() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/internal/api/tokens/introspect", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String resp = "{\"active\":true,\"userId\":\"u123\"}";
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
            WebProfileClient client = new WebProfileClient(baseUrl, null);
            WebProfileClient.TokenIntrospection ti = client.introspectToken("sometoken");
            Assert.assertTrue(ti.active);
            Assert.assertTrue(ti.userId.isPresent());
            Assert.assertEquals("u123", ti.userId.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    public void introspectToken_returnsEmpty_whenInactive() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/internal/api/tokens/introspect", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String resp = "{\"active\":false}";
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
            WebProfileClient client = new WebProfileClient(baseUrl, null);
            WebProfileClient.TokenIntrospection ti = client.introspectToken("sometoken");
            Assert.assertFalse(ti.active);
        } finally {
            server.stop(0);
        }
    }
}
