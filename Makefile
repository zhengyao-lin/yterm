SRC = $(wildcard src/*.ts)
BUILD = $(SRC:src/%.ts=build/%.js)
ENTRYPOINT = build/terminal.js
TARGET = lib/yterm.js

$(TARGET): $(BUILD)
	mkdir -p $(@D)
	browserify $(ENTRYPOINT) -o $(TARGET)

build/%.js: src/%.ts .babelrc
	mkdir -p $(@D)
	babel $< -o $@

.PHONY: clean
clean:
	rm -rf build $(TARGET)
