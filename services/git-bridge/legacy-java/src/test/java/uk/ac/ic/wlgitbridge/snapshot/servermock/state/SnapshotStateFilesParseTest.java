package uk.ac.ic.wlgitbridge.snapshot.servermock.state;

import static org.junit.Assert.fail;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;
import org.junit.Test;

public class SnapshotStateFilesParseTest {

  @Test
  public void allStateJsonFilesParse() throws IOException {
    Path base = Paths.get("src/test/resources");
    try (Stream<Path> paths = Files.walk(base)) {
      paths.filter(p -> p.getFileName().toString().equals("state.json"))
          .forEach(
              p -> {
                try (InputStream is = Files.newInputStream(p)) {
                  new SnapshotAPIStateBuilder(is).build();
                } catch (Exception e) {
                  fail("Failed to parse state.json at " + p.toString() + ": " + e.getMessage());
                }
              });
    }
  }
}
