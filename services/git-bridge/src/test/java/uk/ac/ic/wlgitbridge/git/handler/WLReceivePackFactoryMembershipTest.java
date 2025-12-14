package uk.ac.ic.wlgitbridge.git.handler;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.ReceivePack;
import org.junit.Assert;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.auth.WebProfileClient;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class WLReceivePackFactoryMembershipTest {
    @Test
    public void create_allows_when_member() throws Exception {
        HttpServer introspect = HttpServer.create(new InetSocketAddress(0), 0);
        introspect.createContext("/internal/api/tokens/introspect", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String resp = "{\"active\":true,\"userId\":\"user1\"}";
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, resp.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(resp.getBytes()); }
            }
        });
        introspect.start();

        HttpServer members = HttpServer.create(new InetSocketAddress(0), 0);
        members.createContext("/internal/api/projects/proj/members/user1", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                exchange.sendResponseHeaders(200, -1);
            }
        });
        members.start();

        try {
            System.setProperty("MEMBERSHIP_API_BASE_URL", "http://127.0.0.1:" + members.getAddress().getPort());
            System.setProperty("WEB_PROFILE_BASE_URL", "http://127.0.0.1:" + introspect.getAddress().getPort());
            // Build a temporary repository to pass into create
            Path repoDir = Files.createTempDirectory("repo");
            Repository repo = FileRepositoryBuilder.create(repoDir.resolve(".git").toFile());
            repo.create();

            WLReceivePackFactory f = new WLReceivePackFactory(null, null);

            HttpServletRequest req = mock(HttpServletRequest.class);
            // create a fake oauth credential object with getAccessToken method
            Object credential = new Object() { public String getAccessToken() { return "tok"; } };
            when(req.getAttribute(org.mockito.ArgumentMatchers.eq(uk.ac.ic.wlgitbridge.server.Oauth2Filter.ATTRIBUTE_KEY))).thenReturn(credential);

            ReceivePack rp = f.create(req, repo);
            Assert.assertNotNull(rp);
        } finally {
            introspect.stop(0);
            members.stop(0);
        }
    }

    @Test(expected = SecurityException.class)
    public void create_rejects_when_not_member() throws Exception {
        HttpServer introspect = HttpServer.create(new InetSocketAddress(0), 0);
        introspect.createContext("/internal/api/tokens/introspect", new HttpHandler() {
            @Override
            public void handle(HttpExchange exchange) throws IOException {
                String resp = "{\"active\":true,\"userId\":\"user1\"}";
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, resp.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) { os.write(resp.getBytes()); }
            }
        });
        introspect.start();

        HttpServer members = HttpServer.create(new InetSocketAddress(0), 0);
        // do not register the member path, so 404
        members.start();

        try {
            System.setProperty("MEMBERSHIP_API_BASE_URL", "http://127.0.0.1:" + members.getAddress().getPort());
            System.setProperty("WEB_PROFILE_BASE_URL", "http://127.0.0.1:" + introspect.getAddress().getPort());
            // Build a temporary repository to pass into create
            Path repoDir = Files.createTempDirectory("repo");
            Repository repo = FileRepositoryBuilder.create(repoDir.resolve(".git").toFile());
            repo.create();

            WLReceivePackFactory f = new WLReceivePackFactory(null, null);

            HttpServletRequest req = mock(HttpServletRequest.class);
            Object credential = new Object() { public String getAccessToken() { return "tok"; } };
            when(req.getAttribute(org.mockito.ArgumentMatchers.eq(uk.ac.ic.wlgitbridge.server.Oauth2Filter.ATTRIBUTE_KEY))).thenReturn(credential);

            try {
                f.create(req, repo);
            } finally {
                // cleanup not necessary here
            }
        } finally {
            introspect.stop(0);
            members.stop(0);
        }
    }
}
