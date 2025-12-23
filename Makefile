.PHONY: integration-go integration-go-remote integration-go-all

integration-go-all:
	scripts/run_all_go_integrations.sh

# Run integration for all services/*-go directories (local only)
integration-go:
	@for d in $(shell find services -maxdepth 1 -type d -name '*-go' | sort); do \
		echo "=== checking integration script for $$d ==="; \
		if [ -x "$$d/test/integration/run_integration.sh" ]; then \
			echo "=== running integration for $$d ==="; \
			make -C $$d integration || exit $$?; \
		else \
			echo "skipping $$d (no test/integration/run_integration.sh)"; \
		fi; \
	done

# Run remote integration (includes optional networked Go DB validation) for all *-go services
integration-go-remote:
	@for d in $(shell find services -maxdepth 1 -type d -name '*-go' | sort); do \
		echo "=== checking integration script for $$d ==="; \
		if [ -x "$$d/test/integration/run_integration.sh" ]; then \
			echo "=== running remote integration for $$d ==="; \
			make -C $$d integration-remote || exit $$?; \
		else \
			echo "skipping $$d (no test/integration/run_integration.sh)"; \
		fi; \
	done
# Run unit tests for all -go services
test-go-units:
	@bash scripts/run_all_go_unit_tests.sh

# Run unit tests with optional DB integration
test-go-units-db:
	@bash scripts/run_all_go_unit_tests.sh --run-db