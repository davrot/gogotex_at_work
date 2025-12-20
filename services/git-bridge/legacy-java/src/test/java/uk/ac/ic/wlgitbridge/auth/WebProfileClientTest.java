package uk.ac.ic.wlgitbridge.auth;

import org.apache.http.HttpEntity;
import org.apache.http.StatusLine;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.impl.client.CloseableHttpClient;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

public class WebProfileClientTest {

    @Test
    public void getUserSSHKeys_parsesResponse_andAddsAuthHeader() throws Exception {
        String base = "http://localhost:1234";
        String token = "secrettoken";

        CloseableHttpClient http = mock(CloseableHttpClient.class);
        CloseableHttpResponse resp = mock(CloseableHttpResponse.class);
        StatusLine sl = mock(StatusLine.class);
        HttpEntity ent = mock(HttpEntity.class);

        String body = "[{\"id\":\"k1\",\"keyName\":\"k\",\"publicKey\":\"ssh-rsa AAA...\"}]";

        when(sl.getStatusCode()).thenReturn(200);
        when(ent.getContent()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        when(resp.getStatusLine()).thenReturn(sl);
        when(resp.getEntity()).thenReturn(ent);
        when(http.execute(any(HttpUriRequest.class))).thenReturn(resp);

        WebProfileClient c = new WebProfileClient(base, token, http);
        List<SSHKey> keys = c.getUserSSHKeys("user1");
        Assert.assertEquals(1, keys.size());
        Assert.assertEquals("k1", keys.get(0).getId());

        ArgumentCaptor<HttpUriRequest> capt = ArgumentCaptor.forClass(HttpUriRequest.class);
        verify(http, atLeastOnce()).execute(capt.capture());
        HttpUriRequest req = capt.getValue();
        // When apiToken is present the client uses the service path
        Assert.assertTrue(req.getURI().toString().contains("/internal/api/service/users/user1/ssh-keys"));
        Assert.assertEquals("Bearer " + token, req.getFirstHeader("Authorization").getValue());
    }

    @Test
    public void getUserIdForFingerprint_returnsUser_whenFound() throws Exception {
        String base = "http://localhost:1234";
        CloseableHttpClient http = mock(CloseableHttpClient.class);
        CloseableHttpResponse resp = mock(CloseableHttpResponse.class);
        StatusLine sl = mock(StatusLine.class);
        HttpEntity ent = mock(HttpEntity.class);

        String body = "{\"userId\":\"u123\"}";

        when(sl.getStatusCode()).thenReturn(200);
        when(ent.getContent()).thenReturn(new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        when(resp.getStatusLine()).thenReturn(sl);
        when(resp.getEntity()).thenReturn(ent);
        when(http.execute(any(HttpUriRequest.class))).thenReturn(resp);

        WebProfileClient c = new WebProfileClient(base, null, http);
        Optional<String> uid = c.getUserIdForFingerprint("SHA256:abc");
        Assert.assertTrue(uid.isPresent());
        Assert.assertEquals("u123", uid.get());

        ArgumentCaptor<HttpUriRequest> capt = ArgumentCaptor.forClass(HttpUriRequest.class);
        verify(http, atLeastOnce()).execute(capt.capture());
        HttpUriRequest req = capt.getValue();
        Assert.assertTrue(req.getURI().toString().contains("/internal/api/ssh-keys/SHA256%3Aabc"));
    }
}
