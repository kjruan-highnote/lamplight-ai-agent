BINARY_NAME=graphql-sdl-fetch
DIST_DIR=dist

all: install build

install:
	pip install -r requirements.txt

build:
	pyinstaller --onefile --name $(BINARY_NAME) main.py
	mv dist/$(BINARY_NAME) .

clean:
	rm -rf __pycache__ build dist *.spec $(BINARY_NAME)

.PHONY: all install build clean
