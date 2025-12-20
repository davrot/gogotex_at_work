package uk.ac.ic.wlgitbridge.git;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public final class RepoPathParser {
    private RepoPathParser() {}

    public static String slugFromPath(String path) {
        if (path == null) throw new IllegalArgumentException("path required");
        // expect something like /repo/owner/name(.git)?
        String s = path.trim();
        if (s.endsWith(".git")) {
            s = s.substring(0, s.length() - 4);
        }
        // remove leading /repo or /repo/
        if (s.startsWith("/repo/")) s = s.substring(6);
        else if (s.startsWith("/repo")) s = s.substring(5);

        if (s.isEmpty() || s.endsWith("/")) {
            throw new IllegalArgumentException("malformed repo path: " + path);
        }

        // Decode URL-encoded pieces (space -> %20)
        String decoded = URLDecoder.decode(s, StandardCharsets.UTF_8);

        // Basic validation: must contain at least owner/name
        if (!decoded.contains("/")) {
            throw new IllegalArgumentException("malformed repo path: " + path);
        }
        return decoded;
    }
}
