package uk.ac.ic.wlgitbridge.auth;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.apache.sshd.client.SshClient;
import org.apache.sshd.client.session.ClientSession;
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
import java.nio.file.Files;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class WebProfileSSHServerE2ETest {

  private HttpServer server;
  private int port;

  private final Map<String, List<Map<String, String>>> userKeys = new ConcurrentHashMap<>();
  private final Map<String, String> fpToUser = new ConcurrentHashMap<>();
  private final Gson gson = new Gson();

  @Before
  public void startServer() throws Exception {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    port = server.getAddress().getPort();

    server.createContext("/internal/api/users/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        URI uri = exchange.getRequestURI();
        String path = uri.getPath();
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
            String fp = SSHAuthManager.fingerprintOpenSSH(publicKey);
            if (fp != null && !fp.isEmpty()) fpToUser.put("SHA256:" + fp, userId);
            String resp = gson.toJson(rec);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(201, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
          }
          return;
        }

        if ("GET".equals(exchange.getRequestMethod())) {
          List<Map<String, String>> l = userKeys.getOrDefault(userId, Collections.emptyList());
          String resp = gson.toJson(l);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, bytes.length);
          try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
          return;
        }
        exchange.sendResponseHeaders(405, -1);
      }
    });

    server.createContext("/internal/api/ssh-keys/", new HttpHandler() {
      @Override
      public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String[] parts = path.split("/ssh-keys/");
        if (parts.length != 2) { exchange.sendResponseHeaders(404, -1); return; }
        String fingerprint = parts[1];
        String user = fpToUser.get(fingerprint);
        if (user == null) { exchange.sendResponseHeaders(404, -1); return; }
        String resp = gson.toJson(Collections.singletonMap("userId", user));
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        byte[] bytes = resp.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) { os.write(bytes); }
      }
    });

    server.start();
    try { Thread.sleep(50); } catch (InterruptedException ignored) {}
  }

  @After
  public void stopServer() {
    if (server != null) server.stop(0);
    userKeys.clear(); fpToUser.clear();
  }

  @Test
  public void sshServerAcceptsPubkeyFromWebProfileBackedKey() throws Exception {
    String baseUrl = "http://localhost:" + port;
    String userId = "user-ssh-e2e";

    KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
    kpg.initialize(2048);
    KeyPair kp = kpg.generateKeyPair();
    // Use the OpenSSH wire-format for RSA keys so fingerprint computation matches server-side auth
    java.security.interfaces.RSAPublicKey rsa = (java.security.interfaces.RSAPublicKey) kp.getPublic();
    String publicKey = opensshRsaString(rsa, "e2e@example.com");

    // register key via POST
    java.net.URL url = new java.net.URL(baseUrl + "/internal/api/users/" + userId + "/ssh-keys");
    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
    conn.setDoOutput(true); conn.setRequestMethod("POST"); conn.setRequestProperty("Content-Type","application/json");
    JsonObject body = new JsonObject(); body.addProperty("id","k-e2e"); body.addProperty("keyName","e2e"); body.addProperty("publicKey", publicKey);
    byte[] out = body.toString().getBytes(StandardCharsets.UTF_8);
    conn.setFixedLengthStreamingMode(out.length); conn.connect(); try (OutputStream os = conn.getOutputStream()) { os.write(out); }
    Assert.assertEquals(201, conn.getResponseCode());

    WebProfileClient client = new WebProfileClient(baseUrl, null);
    SSHAuthManager auth = new SSHAuthManager(client);

    // Start SSH server
    java.nio.file.Path tmp = Files.createTempDirectory("ssh-e2e");
    SSHServerManager ssh = new SSHServerManager(0, auth, null, null, tmp.toAbsolutePath().toString());
    ssh.start();
    int portUsed = ssh.getListeningPort();

    String oldHome = System.getProperty("user.home");
    java.nio.file.Path tmpHome = Files.createTempDirectory("ssh-e2e-home");
    System.setProperty("user.home", tmpHome.toAbsolutePath().toString());
    try (SshClient clientSsh = SshClient.setUpDefaultClient()) {
      clientSsh.start();
      try (ClientSession session = clientSsh.connect(userId, "localhost", portUsed).verify(5000).getSession()) {
        session.addPublicKeyIdentity(kp);
        session.auth().verify(5000);
        // If we reach here, auth succeeded
      }
      clientSsh.stop();
    } finally {
      if (oldHome != null) System.setProperty("user.home", oldHome); else System.clearProperty("user.home");
      try { Files.walk(tmpHome).sorted(Comparator.reverseOrder()).forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} }); } catch (IOException ignored) {}
      ssh.stop();
      Files.walk(tmp).sorted(Comparator.reverseOrder()).forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });
    }
  }

  private static String opensshRsaString(java.security.interfaces.RSAPublicKey rsa, String comment) throws java.io.IOException {
    try (java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream()) {
      writeString(baos, "ssh-rsa".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      writeMpint(baos, rsa.getPublicExponent());
      writeMpint(baos, rsa.getModulus());
      String b64 = Base64.getEncoder().encodeToString(baos.toByteArray());
      return "ssh-rsa " + b64 + " " + comment;
    }
  }

  private static void writeString(java.io.ByteArrayOutputStream baos, byte[] data) throws java.io.IOException {
    int len = data.length;
    baos.write(new byte[] { (byte)((len >> 24) & 0xff), (byte)((len >> 16) & 0xff), (byte)((len >> 8) & 0xff), (byte)(len & 0xff) });
    baos.write(data);
  }

  private static void writeMpint(java.io.ByteArrayOutputStream baos, java.math.BigInteger v) throws java.io.IOException {
    if (v == null) v = java.math.BigInteger.ZERO;
    byte[] raw = v.toByteArray();
    writeString(baos, raw);
  }

}
