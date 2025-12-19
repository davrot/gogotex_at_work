package uk.ac.ic.wlgitbridge.auth;

import static org.junit.Assert.*;
import static org.mockserver.model.HttpRequest.request;
import static org.mockserver.model.HttpResponse.response;

import org.junit.Rule;
import org.junit.Test;
import org.mockserver.client.MockServerClient;
import org.mockserver.junit.MockServerRule;

import java.util.Base64;
import java.util.Optional;

/**
 * Integration tests for WebProfileClient (MockServer-backed). These run under the
 * `integration-tests` Maven profile which enables Failsafe.
 */
public class WebProfileClientMockServerIT {
    @Rule public MockServerRule mockServerRule = new MockServerRule(this);

    private MockServerClient mockServerClient;

    @Test
    public void testGetUserIdForFingerprint_NoAuthHeader() throws Exception {
        final String fingerprint = "SHA256:abc123";
        mockServerClient
            .when(request().withMethod("GET").withPath("/internal/api/ssh-keys/.*"))
            .respond(response().withStatusCode(200).withBody("{\"userId\":\"u1\"}"));

        String base = "http://localhost:" + mockServerRule.getPort();
        WebProfileClient client = new WebProfileClient(base, null);

        Optional<String> uid = client.getUserIdForFingerprint(fingerprint);
        assertTrue(uid.isPresent());
        assertEquals("u1", uid.get());

        org.mockserver.model.HttpRequest[] recs = mockServerClient.retrieveRecordedRequests(request().withPath("/internal/api/ssh-keys/.*"));
        assertEquals(1, recs.length);
        String auth = recs[0].getFirstHeader("Authorization");
        assertTrue(auth == null || auth.isEmpty());
    }

    @Test
    public void testGetUserIdForFingerprint_WithBearerToken() throws Exception {
        final String fingerprint = "SHA256:xyz";
        mockServerClient
            .when(request().withMethod("GET").withPath("/internal/api/ssh-keys/.*"))
            .respond(response().withStatusCode(200).withBody("{\"userId\":\"u2\"}"));

        String base = "http://localhost:" + mockServerRule.getPort();
        WebProfileClient client = new WebProfileClient(base, "bearer-token-123");

        Optional<String> uid = client.getUserIdForFingerprint(fingerprint);
        assertTrue(uid.isPresent());
        assertEquals("u2", uid.get());

        org.mockserver.model.HttpRequest[] recs = mockServerClient.retrieveRecordedRequests(request().withPath("/internal/api/ssh-keys/.*"));
        assertEquals(1, recs.length);
        assertEquals("Bearer bearer-token-123", recs[0].getFirstHeader("Authorization"));
    }

    @Test
    public void testGetUserIdForFingerprint_WithBasicToken() throws Exception {
        final String fingerprint = "SHA256:basic";
        mockServerClient
            .when(request().withMethod("GET").withPath("/internal/api/ssh-keys/.*"))
            .respond(response().withStatusCode(200).withBody("{\"userId\":\"u3\"}"));

        String base = "http://localhost:" + mockServerRule.getPort();
        String apiToken = "user:pass"; // contains colon -> Basic
        WebProfileClient client = new WebProfileClient(base, apiToken);

        Optional<String> uid = client.getUserIdForFingerprint(fingerprint);
        assertTrue(uid.isPresent());
        assertEquals("u3", uid.get());

        org.mockserver.model.HttpRequest[] recs = mockServerClient.retrieveRecordedRequests(request().withPath("/internal/api/ssh-keys/.*"));
        assertEquals(1, recs.length);
        String expected = "Basic " + Base64.getEncoder().encodeToString(apiToken.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertEquals(expected, recs[0].getFirstHeader("Authorization"));
    }
}