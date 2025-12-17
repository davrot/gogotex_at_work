package uk.ac.ic.wlgitbridge.auth;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Integration-style unit test that exercises the full WebProfile -> (simulated) Mongo -> SSHAuthManager path.
 *
 * This test runs a tiny in-process HTTP server that exposes the same internal endpoints the real WebProfile
 * provides and stores SSH keys in-memory (simulating Mongo). The test then adds a key via the users endpoint
 * and verifies that both the fingerprint lookup and full key matching code paths in SSHAuthManager work.
 */
public class WebProfileMongoPathIntegrationTest {

  private HttpServer server;
  private int port;

  // userId -> list of keys (maps with id, keyName, publicKey)
  private final Map<String, List<Map<String, String>>> userKeys = new ConcurrentHashMap<>();
  // fingerprint -> userId
  private final Map<String, String> fpToUser = new ConcurrentHashMap<>();

  private final Gson gson = new Gson();

  @Before
  public void startServer() throws Exception {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    port = server.getAddress().getPort();

    // POST /internal/api/users/{userId}/ssh-keys  -> create key (body JSON with id,keyName,publicKey)
    server.createContext("/internal/api/users/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        URI uri = exchange.getRequestURI();
        String path = uri.getPath();
        // Expecting /internal/api/users/{userId}/ssh-keys
        if (!path.startsWith("/internal/api/users/") || !path.endsWith("/ssh-keys")) {
          exchange.sendResponseHeaders(404, -1);
          return;
        }
        String[] parts = path.split("/");
        if (parts.length < 5) {
          exchange.sendResponseHeaders(400, -1);
          return;
        }
        String userId = parts[4];
        if ("POST".equals(exchange.getRequestMethod())) {
          try (InputStream is = exchange.getRequestBody()) {
            String body = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            JsonObject j = gson.fromJson(body, JsonObject.class);
            String id = j.has("id") ? j.get("id").getAsString() : UUID.randomUUID().toString();
            String keyName = j.has("keyName") ? j.get("keyName").getAsString() : "test";
            String publicKey = j.has("publicKey") ? j.get("publicKey").getAsString() : null;
            if (publicKey == null) {
              exchange.sendResponseHeaders(400, -1);
              return;
            }
            Map<String, String> rec = new HashMap<>();
            rec.put("id", id);
            rec.put("keyName", keyName);
            rec.put("publicKey", publicKey);
            userKeys.computeIfAbsent(userId, k -> Collections.synchronizedList(new ArrayList<>())).add(rec);
            // compute fingerprint and store mapping
            String fp = SSHAuthManager.fingerprintOpenSSH(publicKey);
            if (fp != null && !fp.isEmpty()) {
              fpToUser.put("SHA256:" + fp, userId);
            }
            String resp = gson.toJson(rec);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(201, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
              os.write(bytes);
            }
          }
          return;
        }

        if ("GET".equals(exchange.getRequestMethod())) {
          // Return list of keys for user
          List<Map<String, String>> l = userKeys.getOrDefault(userId, Collections.emptyList());
          String resp = gson.toJson(l);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, bytes.length);
          try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
          }
          return;
        }

        exchange.sendResponseHeaders(405, -1);
      }
    });

    // GET /internal/api/ssh-keys/{fingerprint} -> {"userId":"..."}
    server.createContext("/internal/api/ssh-keys/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String[] parts = path.split("/ssh-keys/");
        if (parts.length != 2) {
          exchange.sendResponseHeaders(404, -1);
          return;
        }
        String fingerprint = parts[1];
        String user = fpToUser.get(fingerprint);
        if (user == null) {
          exchange.sendResponseHeaders(404, -1);
          return;
        }
        String resp = gson.toJson(Collections.singletonMap("userId", user));
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
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
    userKeys.clear();
    fpToUser.clear();
  }

  @Test
  public void webProfileMongoPath_allowsSshAuthViaFingerprintAndUserKeys() throws Exception {
    String baseUrl = "http://localhost:" + port;
    String userId = "user-in-db";

    // generate a real keypair and make an OpenSSH-like public key string using the X509 encoded key bytes as base64
    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();
    byte[] enc = kp.getPublic().getEncoded();
    String b64 = Base64.getEncoder().encodeToString(enc);
    String publicKey = "ssh-rsa " + b64 + " test@example.com";

    // POST the key to the "users" endpoint (simulates UI -> WebProfile -> Mongo write)
    java.net.URL url = new java.net.URL(baseUrl + "/internal/api/users/" + userId + "/ssh-keys");
    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
    conn.setDoOutput(true);
    conn.setRequestMethod("POST");
    conn.setRequestProperty("Content-Type", "application/json");
    JsonObject body = new JsonObject();
    body.addProperty("id", "k1");
    body.addProperty("keyName", "playground");
    body.addProperty("publicKey", publicKey);
    byte[] out = body.toString().getBytes(StandardCharsets.UTF_8);
    conn.setFixedLengthStreamingMode(out.length);
    conn.connect();
    try (OutputStream os = conn.getOutputStream()) { os.write(out); }
    int rc = conn.getResponseCode();
    Assert.assertTrue("POST should return 201", rc == 201);

    // Confirm WebProfileClient returns the key
    WebProfileClient client = new WebProfileClient(baseUrl, null);
    List<SSHKey> keys = client.getUserSSHKeys(userId);
    Assert.assertNotNull(keys);
    Assert.assertEquals(1, keys.size());
    Assert.assertEquals("k1", keys.get(0).getId());

    // Compute fingerprint and verify GET by fingerprint via client
    String fp = SSHAuthManager.fingerprintOpenSSH(publicKey);
    Assert.assertFalse("fingerprint should not be empty", fp == null || fp.isEmpty());

    Optional<String> found = client.getUserIdForFingerprint("SHA256:" + fp);
    Assert.assertTrue(found.isPresent());
    Assert.assertEquals(userId, found.get());

    // Now make the SSHAuthManager use the client to authorize the key for the user
    SSHAuthManager auth = new SSHAuthManager(client);
    boolean ok = auth.isKeyAuthorized(userId, publicKey);
    Assert.assertTrue("Key should be authorized via WebProfile/Mongo path", ok);

    // Also assert getUserIdForKey convenience method
    Optional<String> uid = auth.getUserIdForKey(publicKey);
    Assert.assertTrue(uid.isPresent());
    Assert.assertEquals(userId, uid.get());
  }
}
