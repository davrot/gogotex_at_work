package uk.ac.ic.wlgitbridge.contracts;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.HttpURLConnection;
import java.net.URL;

public class MembershipContractTest {
    private HttpServer server;
    private int port;

    @Before
    public void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        port = server.getAddress().getPort();
        server.createContext("/internal/api/projects/proj123/members/user123", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String body = "{\"member\":true}";
                byte[] bytes = body.getBytes();
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
            }
        });
        server.start();
        try { Thread.sleep(100); } catch (InterruptedException ignored) {}
    }

    @After
    public void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    public void membershipEndpoint_returns200_forMember() throws Exception {
        String url = "http://localhost:" + port + "/internal/api/projects/proj123/members/user123";
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("GET");
        int status = conn.getResponseCode();
        Assert.assertEquals(200, status);
    }
}
