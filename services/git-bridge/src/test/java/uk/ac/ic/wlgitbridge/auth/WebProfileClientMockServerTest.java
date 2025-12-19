package uk.ac.ic.wlgitbridge.auth;

import static org.junit.Assert.*;
import static org.mockserver.model.HttpRequest.request;
import static org.mockserver.model.HttpResponse.response;

import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.mockserver.client.MockServerClient;
import org.mockserver.junit.MockServerRule;

import java.util.Optional;

/**
 * Contract-style tests for WebProfileClient against a MockServer instance.
 *
 * NOTE: This class is retained for quick, local runs but is annotated @Ignore
 * so it does not execute in standard CI; the integration test equivalent is
 * `WebProfileClientMockServerIT` which runs under the `integration-tests` profile.
 */
@Ignore("Superseded by integration test WebProfileClientMockServerIT")
public class WebProfileClientMockServerTest {
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

        // Verify that a single request was recorded and it had no Authorization header
        org.mockserver.model.HttpRequest[] recs = mockServerClient.retrieveRecordedRequests(request().withPath("/internal/api/ssh-keys/.*"));
        assertEquals(1, recs.length);
        String auth = recs[0].getFirstHeader("Authorization");
        // MockServer returns empty string when header is absent; accept null/empty as no header
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

        // Verify Authorization header was sent as Bearer
        org.mockserver.model.HttpRequest[] recs = mockServerClient.retrieveRecordedRequests(request().withPath("/internal/api/ssh-keys/.*"));
        assertEquals(1, recs.length);
        assertEquals("Bearer bearer-token-123", recs[0].getFirstHeader("Authorization"));
    }
}