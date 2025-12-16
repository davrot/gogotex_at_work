package uk.ac.ic.wlgitbridge.server;

import static org.mockito.Mockito.*;
import static org.junit.Assert.*;

import com.google.api.client.auth.oauth2.Credential;
import java.lang.reflect.Field;
import java.util.Map;
import javax.servlet.FilterChain;
import javax.servlet.ServletResponse;
import javax.servlet.ServletRequest;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApi;

public class Oauth2FilterTest {

  @Before
  public void setUp() throws Exception {
    // Ensure any earlier system property is cleared
    System.clearProperty("auth.disable_oauth");
  }

  @After
  public void tearDown() throws Exception {
    // Clear the system property set by the test
    System.clearProperty("auth.disable_oauth");
  }

  @Test
  public void whenAuthDisabled_acceptsBasicToken() throws Exception {
    System.setProperty("auth.disable_oauth", "true");

    SnapshotApi api = mock(SnapshotApi.class);
    Oauth2Filter filter = new Oauth2Filter(api, false);

    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse resp = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/6941daf868135692d26ac68d/info/refs");
    when(req.getHeader("Authorization")).thenReturn("Basic Z2l0OnRva2Vu"); // git:token base64

    filter.doFilter(req, resp, chain);

    // Verify that chain.doFilter was invoked once
    verify(chain, times(1)).doFilter(any(ServletRequest.class), any(ServletResponse.class));

    // And that the credential attribute is set on the request
    verify(req, atLeastOnce()).setAttribute(eq(Oauth2Filter.ATTRIBUTE_KEY), any(Credential.class));
  }
}
