.PHONY: integration-go integration-go-remote

# Run integration for all services/*-go directories (local only)
integration-go:
	@for d in $(shell find services -maxdepth 1 -type d -name '*-go' | sort); do \
		echo "=== running integration for $$d ==="; \
		make -C $$d integration || exit $$?; \
	done

# Run remote integration (includes optional networked Go DB validation) for all *-go services
integration-go-remote:
	@for d in $(shell find services -maxdepth 1 -type d -name '*-go' | sort); do \
		echo "=== running remote integration for $$d ==="; \
		make -C $$d integration-remote || exit $$?; \
	done
