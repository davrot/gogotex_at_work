package uk.ac.ic.wlgitbridge.git;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RepoPathParsingTest {

    @Test
    void canonicalExamples() {
        assertEquals("acme/hello-world", RepoPathParser.slugFromPath("/repo/acme/hello-world.git"));
        assertEquals("acme/hello-world", RepoPathParser.slugFromPath("/repo/acme/hello-world"));
        assertEquals("acme/space name", RepoPathParser.slugFromPath("/repo/acme/space%20name.git"));
        assertEquals("acme/nested/inner", RepoPathParser.slugFromPath("/repo/acme/nested/inner.git"));
    }

    @Test
    void malformedPaths() {
        assertThrows(IllegalArgumentException.class, () -> RepoPathParser.slugFromPath("/repo/acme/"));
        assertThrows(IllegalArgumentException.class, () -> RepoPathParser.slugFromPath("/repo/owner/.git"));
    }
}
