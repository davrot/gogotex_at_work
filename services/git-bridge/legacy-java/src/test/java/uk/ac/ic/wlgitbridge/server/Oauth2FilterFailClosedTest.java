package uk.ac.ic.wlgitbridge.server;

import static org.mockito.Mockito.*;
import static org.junit.Assert.*;

import com.google.api.client.auth.oauth2.Credential;
import javax.servlet.FilterChain;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApi;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class Oauth2FilterFailClosedTest {

  @Before
  public void setUp() {
    System.clearProperty("auth.disable_oauth");
    System.clearProperty("auth.fail_closed");
    System.clearProperty("auth.local_introspect_url");
  }

  @After
  public void tearDown() {
    System.clearProperty("auth.disable_oauth");
    System.clearProperty("auth.fail_closed");
    System.clearProperty("auth.local_introspect_url");
  }

  @Test
  public void whenFailClosedAndNoLocalIntrospect_deniesToken() throws Exception {
    System.setProperty("auth.fail_closed", "true");

    SnapshotApi api = mock(SnapshotApi.class);
    Oauth2Filter filter = new Oauth2Filter(api, false);

    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse resp = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/6941daf868135692d26ac68d/info/refs");
    when(req.getHeader("Authorization")).thenReturn("Basic Z2l0OnRva2Vu"); // git:token base64

    filter.doFilter(req, resp, chain);

    // Should not proceed
    verify(chain, never()).doFilter(any(ServletRequest.class), any(ServletResponse.class));

    // Should send 401 or set status via sendResponse
    verify(resp, atLeastOnce()).setStatus(401);
  }

  @Test
  public void whenFailClosedAndLocalIntrospectAllows_allowsToken() throws Exception {
    System.setProperty("auth.fail_closed", "true");

    // Start a small HTTP server that returns active:true for introspection
    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext("/introspect", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        String body = "{\"active\":true}";
        byte[] bytes = body.getBytes();
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
      }
    });
    server.start();
    String url = String.format("http://localhost:%d/introspect", server.getAddress().getPort());
    System.setProperty("auth.local_introspect_url", url);

    SnapshotApi api = mock(SnapshotApi.class);
    Oauth2Filter filter = new Oauth2Filter(api, false);

    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse resp = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/6941daf868135692d26ac68d/info/refs");
    when(req.getHeader("Authorization")).thenReturn("Basic Z2l0OnRva2Vu"); // git:token base64

    filter.doFilter(req, resp, chain);

    // Should proceed
    verify(chain, times(1)).doFilter(any(ServletRequest.class), any(ServletResponse.class));

    server.stop(0);
  }

  @Test
  public void whenFailClosedAndLocalIntrospectDenies_deniesToken() throws Exception {
    System.setProperty("auth.fail_closed", "true");

    // Start a small HTTP server that returns active:false for introspection
    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext("/introspect", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        String body = "{\"active\":false}";
        byte[] bytes = body.getBytes();
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
      }
    });
    server.start();
    String url = String.format("http://localhost:%d/introspect", server.getAddress().getPort());
    System.setProperty("auth.local_introspect_url", url);

    SnapshotApi api = mock(SnapshotApi.class);
    Oauth2Filter filter = new Oauth2Filter(api, false);

    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse resp = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/6941daf868135692d26ac68d/info/refs");
    when(req.getHeader("Authorization")).thenReturn("Basic Z2l0OnRva2Vu"); // git:token base64

    filter.doFilter(req, resp, chain);

    // Should not proceed and should set 401
    verify(chain, never()).doFilter(any(ServletRequest.class), any(ServletResponse.class));
    verify(resp, atLeastOnce()).setStatus(401);

    server.stop(0);
  }
}
