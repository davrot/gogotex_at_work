package repo

import "testing"

func TestSlugFromPath(t *testing.T) {
	cases := map[string]string{
		"/repo/acme/hello-world.git": "acme/hello-world",
		"repo/acme/hello-world": "acme/hello-world",
		"/repo/acme/space%20name.git": "acme/space name",
		"/repo/acme/nested/inner.git": "acme/nested/inner",
		"repo/owner/.git": "owner",
		"/repo//acme///hello-world.git": "acme/hello-world",
		"/repo/acme/%2E%2E/escape.git": "escape", // path.Clean removes '..' segments
	}
	for in, want := range cases {
		got := SlugFromPath(in)
		if got != want {
			t.Fatalf("SlugFromPath(%q) = %q, want %q", in, got, want)
		}
	}
}

func BenchmarkSlugFromPath(b *testing.B) {
	input := "/repo/acme/hello-world.git"
	for i := 0; i < b.N; i++ {
		_ = SlugFromPath(input)
	}
}

